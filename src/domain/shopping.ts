import { z } from "zod";
import { FIXTURE_NOTICE, categoryFeatures, featureLabels } from "./catalog";
import {
  ClaimSchema, DiscoveryProductSchema, OfferSchema, type Candidate, type DiscoveryProduct,
  type Offer, type Preferences, type Priority, type Product, type ProductId, type SelectionResult, type TurnResult,
} from "./contracts";
import { isApprovedUrl, isSafeMerchantOffer, matchesCatalogIdentity } from "./merchant-links";
import { conversationalReply, updatePreferences } from "./preferences";
import type { ProviderContext, ProviderEvent, ProviderName, Providers } from "./providers";

const ProductBoundary = DiscoveryProductSchema.extend({ features: DiscoveryProductSchema.shape.features.max(12) });
const DiscoveryBoundary = z.array(ProductBoundary).max(8);
const ClaimsBoundary = z.array(ClaimSchema).max(16);
const expectedCurrency = { SG: "SGD", US: "USD" } as const;

export type EngineOptions = {
  providerTimeoutMs?: number;
  onProviderEvent?: (event: ProviderEvent) => void;
};

class ProviderFailure extends Error {
  constructor(readonly outcome: "failed" | "timeout") { super("Provider unavailable"); }
}

function supportedFeature(product: Product, feature: string): boolean {
  const claims = product.claims.filter((claim) => claim.key === feature);
  return claims.length === 1 && claims[0].status === "supported" && product.features.includes(feature as Product["features"][number]);
}

function isEligible(product: Product, offer: Offer, preferences: Preferences): boolean {
  const { hard } = preferences;
  return !hard.pendingConstraint && hard.category === product.category
    && !hard.excludedBrands.some((brand) => brand.toLowerCase() === product.brand.toLowerCase())
    && hard.requiredFeatures.every((feature) => supportedFeature(product, feature))
    && hard.requiredFeatures.every((feature) => categoryFeatures[product.category].includes(feature))
    && offer.productId === product.id && offer.region === hard.region
    && offer.price.currency === expectedCurrency[hard.region] && offer.availability === "sample-in-stock"
    && (!hard.budget || (hard.budget.currency === offer.price.currency && offer.price.amount <= hard.budget.amount));
}

const priorityFeatures: Partial<Record<Priority, string[]>> = {
  "noise-cancelling": ["active-noise-cancelling"], "battery-life": ["long-battery-life", "long-battery"],
  portability: ["lightweight", "portable"], "display-quality": ["oled-display"],
};

function rank(candidates: Candidate[], preferences: Preferences): Candidate[] {
  return candidates.sort((a, b) => {
    for (const priority of preferences.soft.priorities) {
      if (priority === "value") {
        const difference = a.offer.price.amount - b.offer.price.amount;
        if (difference) return difference;
      }
      const score = (candidate: Candidate) => (priorityFeatures[priority] ?? []).filter((feature) => supportedFeature(candidate.product, feature)).length;
      const difference = score(b) - score(a);
      if (difference) return difference;
    }
    return a.offer.price.amount - b.offer.price.amount || a.product.id.localeCompare(b.product.id);
  });
}

function reasonsFor(product: Product, offer: Offer, preferences: Preferences): string[] {
  const reasons = [`Sample price ${offer.price.currency} ${offer.price.amount.toFixed(2)}${preferences.hard.budget ? " meets your budget" : ""}.`];
  const preferred = preferences.soft.priorities.flatMap((priority) => priorityFeatures[priority] ?? []);
  const features = [...new Set([...preferences.hard.requiredFeatures, ...preferred])];
  for (const feature of features) {
    if (supportedFeature(product, feature)) reasons.push(`Sample fixture supports ${featureLabels[feature as keyof typeof featureLabels]}.`);
  }
  if (product.claims.some((claim) => claim.status === "conflict")) reasons.push("Tradeoff. Conflicting sample claims are excluded from ranking; inspect the evidence.");
  else reasons.push("Tradeoff. Sample evidence does not establish real-world quality, current price or stock.");
  return reasons.slice(0, preferences.soft.responseLength === "expanded" ? 5 : 3);
}

export function createShoppingEngine(providers: Providers, options: EngineOptions = {}) {
  const timeoutMs = options.providerTimeoutMs ?? 1500;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 5000) throw new Error("Invalid provider deadline");

  async function call<T>(provider: ProviderName, operation: (signal: AbortSignal) => Promise<unknown>, parse: (value: unknown) => T, context?: ProviderContext): Promise<T> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    try {
      context?.signal.throwIfAborted();
      const value = await Promise.race([
        new Promise<never>((_, reject) => {
          onAbort = () => { reject(new ProviderFailure("failed")); controller.abort(context?.signal.reason); };
          context?.signal.addEventListener("abort", onAbort, { once: true });
        }),
        Promise.resolve().then(() => { controller.signal.throwIfAborted(); return operation(controller.signal); }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => { reject(new ProviderFailure("timeout")); controller.abort(); }, timeoutMs); }),
      ]);
      context?.signal.throwIfAborted();
      const result = parse(value);
      options.onProviderEvent?.({ provider, outcome: "ok" });
      return result;
    } catch (error) {
      const outcome = error instanceof ProviderFailure ? error.outcome : "failed";
      if (!context?.signal.aborted) options.onProviderEvent?.({ provider, outcome });
      throw new ProviderFailure(outcome);
    } finally {
      clearTimeout(timer);
      if (onAbort) context?.signal.removeEventListener("abort", onAbort);
      controller.abort();
    }
  }

  function productBoundary(value: unknown): DiscoveryProduct {
    const product = ProductBoundary.parse(value);
    if (!matchesCatalogIdentity(product)) throw new Error("Unrecognized product identity");
    return product;
  }

  async function research(product: DiscoveryProduct, context?: ProviderContext): Promise<Product> {
    const claims = await call("research", (signal) => providers.research.research(product, { signal }), (value) => {
      const result = ClaimsBoundary.parse(value);
      for (const claim of result) {
        const sources = claim.status === "supported" ? claim.sources : claim.status === "conflict" ? claim.observations.map((observation) => observation.source) : [];
        if (sources.some((source) => !isApprovedUrl(source.url) || source.url !== product.productUrl)) throw new Error("Untrusted source URL");
      }
      return result;
    }, context);
    return { ...product, claims };
  }

  async function lookup(product: DiscoveryProduct, preferences: Preferences, context?: ProviderContext): Promise<Offer | null> {
    return call("merchant", (signal) => providers.merchant.lookup(product, preferences, { signal }), (value) => value === null ? null : OfferSchema.parse(value), context);
  }

  function failed(preferences: Preferences): Extract<TurnResult, { kind: "error" }> {
    return { kind: "error", code: "provider-failed", message: "The sample provider could not complete the request. Your preferences are retained. Try again.", retryable: true, preferences, notes: [FIXTURE_NOTICE] };
  }

  async function turn(message: string, previous: Preferences, context?: ProviderContext): Promise<TurnResult> {
    const reply = conversationalReply(message, previous);
    if (reply) return { kind: "message", message: reply, preferences: structuredClone(previous), notes: [] };
    const update = updatePreferences(message, previous);
    const { preferences } = update;
    const notes = [FIXTURE_NOTICE, ...update.notes];
    if (update.clarification) return { kind: "clarification", ...update.clarification, preferences, notes };
    if (preferences.hard.region !== "SG" || (preferences.hard.budget && preferences.hard.budget.currency !== "SGD")) {
      return { kind: "no-match", message: "This catalog has only SG/SGD sample offers. No regional offer or currency conversion is available, so your constraints remain unchanged.", preferences, notes };
    }
    try {
      const products = await call("discovery", (signal) => providers.discovery.discover(preferences, { signal }), (value) => {
        const result = DiscoveryBoundary.parse(value).map(productBoundary);
        if (new Set(result.map((product) => product.id)).size !== result.length) throw new Error("Duplicate product identity");
        return result;
      }, context);
      const researched = await Promise.all(products.map(async (product) => {
        const [details, offer] = await Promise.all([research(product, context), lookup(product, preferences, context)]);
        if (!offer) return null;
        if (!isSafeMerchantOffer(details, offer)) throw new Error("Unsafe merchant link");
        if (!isEligible(details, offer, preferences)) return null;
        return { product: details, offer, reasons: reasonsFor(details, offer, preferences) };
      }));
      const candidates = rank(researched.filter((candidate): candidate is Candidate => candidate !== null), preferences).slice(0, preferences.soft.responseLength === "expanded" ? 5 : 3);
      if (!candidates.length) return { kind: "no-match", message: "No sample product meets every hard constraint with supported evidence and sample stock. Change a budget, excluded brand or required feature explicitly to compare other options.", preferences, notes };
      if (preferences.soft.priorities.some((priority) => ["comfort", "sound-quality", "performance"].includes(priority))) {
        notes.push("Comfort, sound quality and performance lack comparative measurements in this fixture and do not affect ranking.");
      }
      const best = candidates[0];
      const answer = preferences.soft.responseLength === "expanded"
        ? `${best.product.name} leads this sample comparison under your stated constraints. Ranking follows your supported priorities, then sample price. Expand each product for synthetic evidence and tradeoffs. Check exact configuration, regional price and stock on the manufacturer model page.`
        : `${best.product.name} is the leading sample match. ${best.reasons[0]} Check the tradeoffs before choosing.`;
      return { kind: "recommendations", answer, preferences, notes, candidates };
    } catch {
      return failed(preferences);
    }
  }

  async function select(productId: ProductId, preferences: Preferences, context?: ProviderContext): Promise<SelectionResult> {
    const rejected = (code: "invalid-selection" | "unsafe-link" | "not-eligible", message: string): SelectionResult => ({ kind: "error", code, message, retryable: false, preferences, notes: [FIXTURE_NOTICE] });
    if (preferences.hard.pendingConstraint || !preferences.hard.category) return rejected("not-eligible", "Resolve the category and pending requirements before selecting a product.");
    try {
      const product = await call("discovery", (signal) => providers.discovery.findById(productId, { signal }), (value) => value === null ? null : productBoundary(value), context);
      if (!product || product.id !== productId) return rejected("invalid-selection", "That product ID is not in this catalog.");
      const [details, offer] = await Promise.all([research(product, context), lookup(product, preferences, context)]);
      if (!offer) return rejected("not-eligible", "No sample offer supports your region and currency. Your constraints were not changed.");
      if (!isSafeMerchantOffer(details, offer)) return rejected("unsafe-link", "The provider did not return the exact approved product destination. No link is available.");
      if (!isEligible(details, offer, preferences)) return rejected("not-eligible", "This product does not meet all current hard constraints or has unavailable or unknown sample stock.");
      return {
        kind: "handoff", productId: product.id, productName: product.name, offer, productUrl: offer.productUrl,
        label: "Open manufacturer model reference. Synthetic sample price and stock only. Regional pricing, configuration, availability and page redirects are unverified. No purchase is placed.",
      };
    } catch {
      return failed(preferences);
    }
  }
  return { turn, select };
}
