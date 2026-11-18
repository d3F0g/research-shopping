import { catalog, FIXTURE_OBSERVED_AT, featureLabels, type CatalogId } from "../domain/catalog";
import { ProductIdSchema, SourceIdSchema, type Claim, type DiscoveryProduct, type Offer, type Source } from "../domain/legacy-contracts";
import type { Providers, ProviderName } from "../domain/providers";

export type FixtureFailures = Partial<Record<ProviderName, "error" | "timeout" | "malformed">>;

function productFor(id: CatalogId): DiscoveryProduct {
  const item = catalog[id];
  return {
    id: ProductIdSchema.parse(id), category: item.category, brand: item.brand, name: item.name,
    summary: item.summary, features: [...item.features], manufacturer: item.brand, productUrl: item.productUrl,
  };
}

function sourceFor(product: DiscoveryProduct, suffix = "reference"): Source {
  return {
    id: SourceIdSchema.parse(`${product.id}-${suffix}`), name: `Synthetic fixture ${suffix}. ${product.brand} model reference`,
    url: product.productUrl, kind: "fixture-observation", capturedAt: FIXTURE_OBSERVED_AT,
  };
}

function claimsFor(product: DiscoveryProduct): Claim[] {
  const source = sourceFor(product);
  const claims: Claim[] = product.features.map((feature) => ({
    status: "supported", key: feature, value: `Sample fixture. ${featureLabels[feature]}.`, sources: [source],
  }));
  claims.push({ status: "unknown", key: "delivery", note: "Unknown. This fixture does not establish shipping, delivery time or warranty." });
  if (product.id === "sony-wh-ch720n" || product.id === "asus-vivobook-s14-s3407") {
    const battery = product.category === "headphones";
    claims.push({
      status: "conflict", key: battery ? "long-battery-life" : "high-memory",
      observations: [
        { value: battery ? "Sample fixture A. 35 hours with ANC." : "Sample fixture A. 16 GB memory.", source: sourceFor(product, "observation-a") },
        { value: battery ? "Sample fixture B. 50 hours, mode unspecified." : "Sample fixture B. 32 GB memory, variant unspecified.", source: sourceFor(product, "observation-b") },
      ],
    });
  }
  claims.push({ status: "unknown", key: product.category === "headphones" ? "sound-quality" : "performance", note: "Unknown. No independent comparative measurement exists in this fixture." });
  return claims;
}

async function injectFailure(mode: FixtureFailures[ProviderName], signal: AbortSignal): Promise<void> {
  if (mode === "error") throw new Error("Injected provider failure");
  if (mode === "timeout") {
    await new Promise<void>((_, reject) => {
      if (signal.aborted) reject(new Error("Aborted"));
      else signal.addEventListener("abort", () => reject(new Error("Aborted")), { once: true });
    });
  }
}

export function createFixtureProviders(failures: FixtureFailures = {}): Providers {
  return {
    discovery: {
      async discover(preferences, { signal }) {
        await injectFailure(failures.discovery, signal);
        if (failures.discovery === "malformed") return [{ id: "broken" }] as DiscoveryProduct[];
        return (Object.keys(catalog) as CatalogId[]).map(productFor).filter((product) => product.category === preferences.hard.category);
      },
      async findById(id, { signal }) {
        await injectFailure(failures.discovery, signal);
        if (failures.discovery === "malformed") return { id: "broken" } as DiscoveryProduct;
        return Object.hasOwn(catalog, id) ? productFor(id as CatalogId) : null;
      },
    },
    research: {
      async research(product, { signal }) {
        await injectFailure(failures.research, signal);
        if (failures.research === "malformed") return [{ status: "made-up" }] as unknown as Claim[];
        return claimsFor(product);
      },
    },
    merchant: {
      async lookup(product, preferences, { signal }) {
        await injectFailure(failures.merchant, signal);
        if (failures.merchant === "malformed") return { productId: "broken" } as Offer;
        if (preferences.hard.region !== "SG" || (preferences.hard.budget && preferences.hard.budget.currency !== "SGD")) return null;
        const item = catalog[product.id as CatalogId];
        return {
          productId: product.id, merchant: `${product.brand} model page`, merchantHost: new URL(product.productUrl).hostname,
          productUrl: product.productUrl, region: "SG", price: { amount: item.price, currency: "SGD" },
          availability: item.availability, observedAt: FIXTURE_OBSERVED_AT, dataKind: "fixture",
        };
      },
    },
  };
}
