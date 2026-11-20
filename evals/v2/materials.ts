import { materialPayloadHash } from "../hash";
import { scenarioMaterial } from "../inputs/materials";
import type { Json, Material } from "../frozen-v4/contracts";
import type { z } from "zod";
import type { NativeAnswerSchema } from "../../src/server/exa-answer-v2";

type Answer = z.infer<typeof NativeAnswerSchema>;
const profiles: Record<string, { name: string; description: string; currency: string; amounts: number[] }> = {
  "FN-CU-001": { name: "Fixture Current Pocket", description: "USB-C portable power bank", currency: "SGD", amounts: [35] },
  "FN-RT-002": { name: "Fixture Current Fieldglass", description: "8x binocular for birdwatching", currency: "USD", amounts: [140, 180, 220] },
  "FN-PQ-001": { name: "Fixture Current Voice", description: "USB microphone for spoken-word recording", currency: "SGD", amounts: [90, 120, 160] },
};
export function currentScenarioMaterial(recipe: string, scenarioId: string): Material {
  const profile = profiles[scenarioId];
  if (!profile || !["supported", "held-comparison"].includes(recipe)) return scenarioMaterial(recipe, scenarioId);
  const sources = profile.amounts.map((amount, index) => {
    const name = `${profile.name} ${index + 1}`, variant = "standard";
    const identity = `Fixture data. ${name} ${variant} is a ${profile.description}.`;
    const quote = `${profile.currency} ${amount.toFixed(2)}`;
    return { url: `https://fixture.example.com/current-${scenarioId.toLowerCase()}-${index}`, title: `${name} invented fixture`, name, variant, identity, quote, text: `${identity}\n\n| Selected item | Price | Terms |\n| --- | --- | --- |\n| ${name} ${variant} | ${quote} | One unit, tax included. |\n\nFixture data only. Stock and delivery remain unknown.` };
  });
  const assessment = (url: string, quote: string): Answer["products"][number]["identity"] => ({ status: "supported", scope: "exact-variant", rationale: "Fixture source-based AI assessment. No live product claim.", support: [{ url, quote }] });
  const products: Answer["products"] = sources.map((source, index) => ({
    id: `fixture-current-${index}`, name: source.name, variant: source.variant,
    identity: assessment(source.url, source.identity), requestMatch: assessment(source.url, source.identity), criteria: [],
    attributes: [{ name: "Use", assessment: assessment(source.url, source.identity) }, ...(scenarioId === "FN-PQ-001" ? [{ name: "Background-noise rejection", assessment: { status: "unknown" as const, scope: "exact-variant" as const, rationale: "Fixture data does not contain measured background-noise rejection. A directional description cannot establish room-noise performance.", support: [] } }] : [])],
    price: { amount: profile.amounts[index]!, currency: profile.currency, variant: source.variant, moneySupport: { url: source.url, quote: source.quote }, attribution: assessment(source.url, source.identity), priceBasis: { kind: "single-item", assessment: assessment(source.url, source.text.split("\n\n")[1]!) },
      sourceReviews: sources.map((entry, sourceIndex) => ({ url: entry.url, reviewComplete: true, relation: sourceIndex === index ? "applies" : "other-product-or-topic", assessment: assessment(entry.url, entry.identity), moneyMentions: [{ quote: entry.quote, role: sourceIndex === index ? "selected" : "other-product", scope: sourceIndex === index ? "selected-variant" : "other-subjects", assessment: assessment(entry.url, entry.quote) }], conditions: [{ quote: "tax included", text: "Fixture tax included", interpretation: "included-in-amount", rationale: "Fixture source states that tax is included." }] })),
    },
  }));
  const answer: Answer = { answerVersion: 2, products, choice: null, limitations: ["Explicit synthetic V5 provider composition. Missing request-specific criterion evidence remains unknown. No live research or merchant verification."] };
  const body = JSON.parse(JSON.stringify({ answer, citations: sources.map(({ url, title, text }) => ({ url, title, text })), requestId: `fixture-v5-${scenarioId}`, costDollars: { total: 0.005 } })) as Json;
  return { id: `fixture-v5-${scenarioId}`, kind: "synthetic", label: "Explicit current V5 synthetic provider fixture; original native1 material remains unchanged.", capturedAt: null, provenance: ["Separately authored fixed V5 test composition for the unchanged public scenario", "Original frozen native1 material is not converted or repaired", "No product acceptance, current-price or merchant-authority claim"], body, status: 200, sha256: materialPayloadHash({ body, status: 200 }) };
}
