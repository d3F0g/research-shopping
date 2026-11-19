import { describe, expect, it } from "vitest";
import { initialConversation } from "../../src/domain/conversation";
import { ResearchSnapshotSchema, type ResearchSnapshot } from "../../src/domain/research";
import { projectExaAnswer } from "../../src/server/exa-research";
import { catalogMaterial } from "../helpers/v3-catalog-material";
import { nativeMaterial } from "../helpers/v2-material";

const intent = { ...initialConversation().intent, productDescription: "Fixture sunglasses", budget: { minimum: 800, maximum: 1000, currency: "SGD" } };
function project(material = catalogMaterial(intent)) {
  const result = projectExaAnswer(material, intent);
  if (result.status !== "ready") throw new Error("Expected fixture comparison");
  return result.research;
}
describe("versioned literal source evidence", () => {
  it("retains unique whitespace-aligned identity and its observed catalog amount without resolving conditions", () => {
    const snapshot = project();
    const product = snapshot.products[0]!;
    expect(snapshot).toMatchObject({ version: 2, evidenceVersion: 3, choice: null });
    expect(product.identity.status).toBe("supported");
    expect(product.identity.support[0]).toMatchObject({ origin: { kind: "provider", reportedQuote: "Fixture Meridian Sunglasses - Silver SGD 868", match: "whitespace" }, literal: { text: "Fixture Meridian Sunglasses - Silver \n\n SGD 868" } });
    expect(product.price).toMatchObject({ amount: 868, currency: "SGD", variant: "Silver", conditionsResolved: false, conditions: ["Provider-reported, unverified: Price as listed on Fixture Index."] });
    expect(snapshot.summary).toMatch(/^The source lists Fixture Meridian Sunglasses - Silver at SGD 868.00, observed and unverified/);
    expect(snapshot.summary).toContain("Purchase conditions remain unresolved.");
    expect(snapshot.summary).toContain("Fit to your complete shopping objective remains unresolved.");
    expect(snapshot.summary).not.toMatch(/best|all.*fit|source-supported option/);
    expect(product.eligible).toBe(false);
    expect(snapshot.intent.budget).toEqual(intent.budget);
  });
  it.each(["Fixture Meridian Sunglasses — Silver SGD 868", "Fixture Meridian Sunglasses - Silver … SGD 868", "Fixture Meridian Silver SGD 868", "Fixture Meridian Sunglasses - silver SGD 868", "Fixture Meridian Sunglasses - Sil\u200bver SGD 868"])("does not repair non-whitespace changes in %s", (quote) => {
    const material = catalogMaterial(intent);
    material.answer.products[0]!.identity.support[0]!.quote = quote;
    expect(project(material).products[0]!.identity.status).toBe("unknown");
  });
  it("rejects duplicate equivalent source spans rather than selecting the first occurrence", () => {
    const material = catalogMaterial(intent);
    material.citations[0]!.text += "\n\nFixture Meridian Sunglasses - Silver SGD 868";
    expect(project(material).products[0]!.identity.status).toBe("unknown");
  });
});

describe("named catalog attribution boundaries", () => {
  it.each([
    ["SGD 868", "SGD 868–1200"],
    ["SGD 868", "SGD 868 for three units"],
    ["SGD 868", "SGD 868\nFor AX2 only."],
    ["SGD 868", "SGD 868\n\nFor AX2."],
    ["SGD 868", "SGD 868\n\nShipping costs SGD 100."],
    ["SGD 868", "SGD 868\n\nPrice applies to another variant."],
  ])("withholds attribution when selected amount has unsafe context %j", (from, to) => {
    const material = catalogMaterial(intent);
    material.citations[0]!.text = material.citations[0]!.text.replace(from, to);
    expect(project(material).products[0]!.price).toBeNull();
  });
  it("never takes the neighboring row's amount", () => {
    const material = catalogMaterial(intent);
    const product = material.answer.products[0]!;
    product.price.amount = 305;
    product.price.assessment.support[0]!.quote = "SGD 305";
    expect(project(material).products[0]!.price).toBeNull();
  });
  it.each(["Gold", "Sil", "Silverado"])("requires an explicit exact selected variant %s", (variant) => {
    const material = catalogMaterial(intent);
    material.answer.products[0]!.variant = variant;
    material.answer.products[0]!.price.variant = variant;
    expect(project(material).products[0]!.price).toBeNull();
  });
  it("does not turn money-only source support into complete request fit even without a budget", () => {
    const material = catalogMaterial(intent);
    const result = projectExaAnswer(material, { ...intent, budget: null });
    if (result.status !== "ready") throw new Error("Expected fixture comparison");
    expect(result.research.products[0]!.requestMatch.status).toBe("unknown");
    expect(result.research.choice).toBeNull();
  });
  it("retains actual membership conditions and unresolved provider context distinctly", () => {
    const material = catalogMaterial(intent);
    material.citations[0]!.text += "\n\nMembership required.";
    const product = project(material).products[0]!;
    expect(product.price).toMatchObject({ conditionsResolved: false, conditions: ["Membership required", "Provider-reported, unverified: Price as listed on Fixture Index."] });
  });
  it("keeps the complete 300-character native condition with its provenance label", () => {
    const material = catalogMaterial(intent);
    material.answer.products[0]!.price.conditions = ["Fixture provider uncertainty. " + "x".repeat(270)];
    const reported = material.answer.products[0]!.price.conditions[0]!;
    expect(project(material).products[0]!.price?.conditions).toContain(`Provider-reported, unverified: ${reported}`);
  });
  it.each(["", "\n\nNot tax included."])("does not promote an unproven native tax-included claim %j", (tail) => {
    const material = catalogMaterial(intent);
    material.answer.products[0]!.price.conditions = ["tax included"];
    material.citations[0]!.text += tail;
    const product = project(material).products[0]!;
    expect(product.price?.conditionsResolved).toBe(false);
    expect(product.price?.conditions).not.toContain("tax included");
    if (tail) expect(product.price?.conditions).toContain("Not tax included");
  });
});

describe("opaque peer catalog rows", () => {
  const peers = "Fixture Other Eyeglasses - Black\n\n SGD 547 SGD 268 (51% off)\n\nFixture Other Brand Silver Navigator Sunglasses\n\n SGD 490 SGD 243 (50% off)\n\n";
  it("retains the selected single amount beside opaque sale prices and a shared color name", () => {
    const material = catalogMaterial(intent);
    material.citations[0]!.text = peers + material.citations[0]!.text;
    const result = project(material);
    expect(result.products[0]!.price).toMatchObject({ amount: 868, currency: "SGD", conditionsResolved: false });
    expect(result.products[0]!.identity.status).toBe("supported");
    expect(result.choice).toBeNull();
    expect(result.sources[0]!.text).toContain(peers);
  });
  it.each(["SGD 868 SGD 500 (50% off)", "SGD 868–1200", "SGD 868 for three units", "SGD 868\n\nFor Gold only."])("rejects target ambiguity even beside opaque peer sales %s", (selected) => {
    const material = catalogMaterial(intent);
    material.citations[0]!.text = peers + material.citations[0]!.text.replace("SGD 868", selected);
    expect(project(material).products[0]!.price).toBeNull();
  });
  it.each([
    "\n\nFixture Meridian Sunglasses - Silver costs SGD 999.",
    "\n\nShipping costs SGD 100.",
    "\n\nPrice applies to Gold only.",
  ])("retains unsafe unscoped or target-naming clauses outside peer spans %s", (tail) => {
    const material = catalogMaterial(intent);
    material.citations[0]!.text = peers + material.citations[0]!.text + tail;
    expect(project(material).products[0]!.price).toBeNull();
  });
});


describe("current snapshot binding validation", () => {
  const mutations: Array<[string, (snapshot: ResearchSnapshot) => void]> = [
    ["literal offset", (snapshot) => { snapshot.products[0]!.identity.support[0]!.literal.start++; }],
    ["literal text", (snapshot) => { snapshot.products[0]!.identity.support[0]!.literal.text += "Invented"; }],
    ["context containment", (snapshot) => { snapshot.products[0]!.identity.support[0]!.context.start++; }],
    ["context text", (snapshot) => { snapshot.products[0]!.identity.support[0]!.context.text = "Fixture invented context"; }],
    ["reported wording", (snapshot) => { snapshot.products[0]!.identity.support[0]!.origin = { kind: "provider", reportedQuote: "Fixture changed words SGD 868", match: "whitespace" }; }],
    ["match kind", (snapshot) => { const span = snapshot.products[0]!.identity.support[0]!; if (span.origin.kind === "provider") span.origin.match = "literal"; }],
    ["cut metadata", (snapshot) => { snapshot.sources[0]!.originalLength++; }],
    ["duplicate equivalent match", (snapshot) => { snapshot.sources[0]!.text += "\n\nFixture Meridian Sunglasses - Silver SGD 868"; snapshot.sources[0]!.originalLength = snapshot.sources[0]!.text.length; }],
  ];
  it.each(mutations)("rejects forged %s at the current response boundary", (_name, mutate) => {
    const snapshot = project();
    expect(ResearchSnapshotSchema.safeParse(snapshot).success).toBe(true);
    mutate(snapshot);
    expect(ResearchSnapshotSchema.safeParse(snapshot).success).toBe(false);
  });
});


describe("money-only request evidence", () => {
  const variants = ["SGD 35", "35 SGD", "35SGD", "35", "S$35", "35 S$", "$35", "35.00", "SGD 35.00", "35 SGD.", "(35 SGD)", "SGD 35–40", "35 / 40 SGD", "SGD 35 + SGD 40", "35 Singapore dollars", "Singapore dollars35", "Price: SGD35", "SGD35 per unit", "SGD35 including tax", "35to40SGD"];
  for (const budget of [null, { minimum: 30, maximum: 40, currency: "SGD" }]) {
    it.each(variants)(`keeps %s unknown with ${budget ? "bounded" : "no"} budget`, (quote) => {
      const request = { ...initialConversation().intent, productDescription: "Fixture USB-C powerbank", budget };
      const raw = nativeMaterial(request);
      const sourceMoney = ["35", "35.00"].includes(quote) ? `SGD ${quote}` : quote;
      const material = JSON.parse(JSON.stringify(raw).replaceAll("SGD 35", sourceMoney));
      material.answer.products[0].requestMatch = { ...material.answer.products[0].requestMatch, support: [{ url: material.citations[0].url, quote }] };
      const result = projectExaAnswer(material, request);
      if (result.status !== "ready") throw new Error("Expected fixture comparison");
      expect(result.research.products[0]!.identity.status).toBe("supported");
      expect(result.research.products[0]!.requestMatch.status).toBe("unknown");
      expect(result.research.products[0]!.eligible).toBe(false);
      expect(result.research.choice).toBeNull();
    });
    it(`retains whole-objective sentence evidence with ${budget ? "bounded" : "no"} budget`, () => {
      const request = { ...initialConversation().intent, productDescription: "Fixture USB-C powerbank", budget };
      const result = projectExaAnswer(nativeMaterial(request), request);
      if (result.status !== "ready") throw new Error("Expected fixture comparison");
      expect(result.research.products[0]!.requestMatch.status).toBe("supported");
      expect(result.research.choice?.productId).toBe("model-a");
    });
  }
});

describe("ambiguous catalog headings", () => {
  it.each([
    "Fixture Meridian Sunglasses - Silver",
    "Fixture Meridian Sunglasses -  Silver",
    "fixture meridian sunglasses - silver",
    "Fixture Meridian Sunglasses",
    "Meridian Sunglasses - Silver",
    "Meridian Sunglasses - Silver (standard)",
    "Meridian Sunglasses - Silver Edition",
    "Meridian Sunglasses - Silver Extended Fixture Description",
    "Silver Edition",
    "Silver colorway",
    "Silver-Standard",
    "Silver52mm",
    "Meridian Sunglasses - Silver, size 52",
    "New Silver colorway",
    "Limited Silver52mm",
    "Silver",
    " silver ",
  ])("retains unresolved target heading %j as adverse context", (heading) => {
    const material = catalogMaterial(intent);
    material.citations[0]!.text += `\n\n${heading}\n\nSGD 999`;
    const result = project(material);
    expect(result.products[0]!.price).toBeNull();
    expect(result.sources[0]!.text).toBe(material.citations[0]!.text);
    expect(result.choice).toBeNull();
  });
  it("retains a distinct full heading sharing only the selected color", () => {
    const material = catalogMaterial(intent);
    material.citations[0]!.text += "\n\nFixture Other Silver Sunglasses\n\nSGD 999 SGD 499 (50% off)";
    expect(project(material).products[0]!.price).toMatchObject({ amount: 868, conditionsResolved: false });
  });
});


describe("unique catalog heading binding", () => {
  it("retains the raw heading span when its only difference is whitespace", () => {
    const material = catalogMaterial(intent);
    material.citations[0]!.text = material.citations[0]!.text.replace("Fixture Meridian Sunglasses - Silver", "Fixture Meridian Sunglasses -  Silver");
    const snapshot = project(material);
    expect(snapshot.products[0]!.identity.status).toBe("supported");
    expect(snapshot.products[0]!.price).toMatchObject({ amount: 868, conditionsResolved: false });
    expect(snapshot.sources[0]!.text).toBe(material.citations[0]!.text);
  });
  it("does not use adverse case folding to create a positive heading binding", () => {
    const material = catalogMaterial(intent);
    material.citations[0]!.text = material.citations[0]!.text.replace("Fixture Meridian Sunglasses - Silver", "fixture meridian sunglasses - silver");
    material.answer.products[0]!.identity.support[0]!.quote = material.citations[0]!.text;
    expect(project(material).products[0]!.price).toBeNull();
  });
});

describe("monetary grammar and open product descriptions", () => {
  it.each(["RTX4080", "USB3", "ABC35", "USDock35", "Fixture Orinth lunar spectrometer 7"])("does not classify %s as currency by its letter count", (name) => {
    const request = { ...initialConversation().intent, productDescription: `Fixture ${name}`, budget: null };
    const raw = nativeMaterial(request);
    const source = raw.citations[0]!.text;
    const material = JSON.parse(JSON.stringify(raw).replaceAll(JSON.stringify(source).slice(1, -1), JSON.stringify(`Fixture data: ${name}. ${source}`).slice(1, -1)));
    material.answer.products[0].requestMatch = { ...material.answer.products[0].requestMatch, support: [{ url: material.citations[0].url, quote: name }] };
    const result = projectExaAnswer(material, request);
    if (result.status !== "ready") throw new Error("Expected fixture comparison");
    expect(result.research.products[0]!.requestMatch.support).toHaveLength(1);
    expect(result.research.products[0]!.requestMatch.status).toBe("supported");
    expect(result.research.products[0]!.requestMatch.support[0]!.literal.text).toBe(name);
  });
  it.each(["tax included", "including GST", "per unit", "for one unit", "membership required", "this price requires a voucher and a coupon", "mandatory shipping charges", "only available with membership"])("downgrades money with the existing condition %s", (condition) => {
    const request = { ...initialConversation().intent, productDescription: "Fixture powerbank", budget: null };
    const quote = `CHF35, ${condition}`;
    const material = JSON.parse(JSON.stringify(nativeMaterial(request)).replaceAll("SGD 35", quote));
    material.answer.products[0].price.currency = "CHF";
    material.answer.products[0].requestMatch = { ...material.answer.products[0].requestMatch, support: [{ url: material.citations[0].url, quote }] };
    const result = projectExaAnswer(material, request);
    if (result.status !== "ready") throw new Error("Expected fixture comparison");
    expect(result.research.products[0]!.requestMatch.status).toBe("unknown");
    expect(result.research.choice).toBeNull();
  });
});

it("uses the explicit budget currency for monetary evidence when no native price exists", () => {
  const request = { ...initialConversation().intent, productDescription: "Fixture powerbank", budget: { currency: "CAD", maximum: 40 } };
  const material = JSON.parse(JSON.stringify(nativeMaterial(request)).replaceAll("SGD 35", "CAD35"));
  material.answer.products[0].price = null;
  material.answer.products[0].requestMatch = { ...material.answer.products[0].requestMatch, support: [{ url: material.citations[0].url, quote: "CAD35 per unit" }] };
  const source = material.citations[0].text;
  const updated = JSON.parse(JSON.stringify(material).replaceAll(JSON.stringify(source).slice(1, -1), JSON.stringify(source + " Fixture monetary note: CAD35 per unit.").slice(1, -1)));
  const result = projectExaAnswer(updated, request);
  if (result.status !== "ready") throw new Error("Expected fixture comparison");
  expect(result.research.products[0]!.requestMatch.support).toHaveLength(1);
  expect(result.research.products[0]!.requestMatch.status).toBe("unknown");
});
