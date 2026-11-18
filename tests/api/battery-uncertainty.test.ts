import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { defaultPreferences, type Preferences } from "../../src/domain/contracts";
import { ApplicationTurnResponseSchema } from "../../src/domain/research";
import { createApp } from "../../src/server/app";
import { createExaProductResearch } from "../../src/server/exa-research";
import { createResearchTurns } from "../../src/server/research-turns";
import { ath, capturedReplay, nativeObservations } from "../fixtures/native-alignment";

const unknownBattery = "Battery life for this model or edition is unknown from the retained comparison evidence.";

function requested(category: "headphones" | "laptops" = "headphones"): Preferences {
  const preferences = defaultPreferences();
  preferences.hard.category = category;
  preferences.hard.budget = { amount: 400, currency: "SGD" };
  preferences.soft.priorities = ["battery-life"];
  return preferences;
}

async function research(payload: unknown, preferences = requested()) {
  let searches = 0;
  let settlements = 0;
  const server = createServer(async (request, response) => {
    for await (const _chunk of request) {}
    searches++;
    expect(request.url).toBe("/search");
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(payload));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const target = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    expect(new URL(target).origin).toBe(baseUrl);
    return originalFetch(input, init);
  };
  const app = createApp({ researchTurns: createResearchTurns({
    research: createExaProductResearch("fake-automated-battery-key", { baseUrl }),
    quota: { async reserve() { return "admitted"; }, async settle() { settlements++; } },
  }) }, { apiPort: 6369, webPort: 6370 });
  try {
    const response = await app.request("http://127.0.0.1:6369/api/turn", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: `${preferences.hard.category} under SGD400`, preferences, operationId: randomUUID() }),
    });
    expect(response.status).toBe(200);
    expect(searches).toBe(1);
    expect(settlements).toBe(1);
    const result = ApplicationTurnResponseSchema.parse(await response.json());
    expect(result.kind).toBe("research");
    if (result.kind !== "research") throw new Error("Expected synthetic research observations");
    return result.research;
  } finally {
    globalThis.fetch = originalFetch;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function synthetic(text: string, facts: string[], category: "headphones" | "laptops" = "headphones") {
  const name = "Aster Wave 2";
  const heading = `# ${name}\n${category === "headphones" ? "Wireless over-ear headphones" : "Laptop computer"}.`;
  const identity = `${name} ${category === "headphones" ? "Wireless over-ear headphones" : "Laptop computer"}`;
  return {
    requestId: "automated-synthetic-battery-observation",
    costDollars: { total: 0.007 },
    results: [{ title: name, url: "https://reviews.example.com/synthetic-battery", highlights: [`${heading}\n${text}`] }],
    output: { content: { observations: [{ name, url: "https://reviews.example.com/synthetic-battery", identityQuote: identity, quotedFacts: facts, priceQuote: null }] } },
  };
}

it("distinguishes captured Edifier edition uncertainty from the retained qualified ATH observation", async () => {
  const snapshot = await research(capturedReplay);
  const edifier = snapshot.products.find((product) => product.name === "Edifier WH950NB (2025 edition) Wireless Noise Cancelling Headphone")!;
  expect(edifier.facts.map((fact) => fact.quote)).toEqual(["Titanium-coated 40mm drivers deliver powerful, balanced sound."]);
  expect(edifier.unresolvedConstraints).toContain(unknownBattery);
  const audioTechnica = snapshot.products.find((product) => product.name === ath.name)!;
  expect(audioTechnica.facts.map((fact) => fact.quote)).toEqual([ath.battery, ath.driver]);
  expect(audioTechnica.unresolvedConstraints).not.toContain(unknownBattery);
  expect(snapshot.products.flatMap((product) => product.facts).map((fact) => Object.keys(fact).sort())).toEqual(
    snapshot.products.flatMap((product) => product.facts).map(() => ["quote", "sourceId"]),
  );
});

describe("synthetic battery comparison controls", () => {
  it.each(["headphones", "laptops"] as const)("recognizes only retained positive runtime forms for %s", async (category) => {
    for (const fact of ["Battery life: up to 40 hours with ANC off.", "Runtime: 24 hours per charge.", "These " + category + " have 12 hours on a full charge.", "You get 30 hours of playback."]) {
      const product = (await research(synthetic(fact, [fact], category), requested(category))).products[0];
      expect(product.facts.map((citation) => citation.quote)).toEqual([fact]);
      expect(product.unresolvedConstraints).not.toContain(unknownBattery);
      expect(product.stock).toBe("unverified");
    }
  });

  it.each([
    "Battery life: No.",
    "These headphones do not have long battery life.",
    "Does it have 30 hours of playback?",
    "If these headphones have 30 hours of playback.",
    "Other Model has 30 hours of playback.",
    "Aster Wave 2 Pro has 30 hours of playback.",
    "These headphones have 30 hours of playback if used with an accessory.",
    "Replacement pads have 30 hours of playback.",
    "These headphones have long battery life.",
    "Charging time: 2 hours.",
  ])("keeps runtime unknown for unestablished source wording %s", async (fact) => {
    const product = (await research(synthetic(fact, [fact]))).products[0];
    expect(product).toBeDefined();
    expect(product.unresolvedConstraints).toContain(unknownBattery);
  });

  it("preserves unsupported direct wording literally without treating it as comparable runtime", async () => {
    const identity = "Aster Wave 2 is a wireless over-ear headphone.";
    const fact = "Aster Wave 2 has a battery that lasts 30 hours.";
    const payload = synthetic("", []);
    payload.results[0].highlights = [`${identity}\n${fact}`];
    payload.output.content.observations[0] = { ...payload.output.content.observations[0], identityQuote: identity, quotedFacts: [identity, fact] };
    const product = (await research(payload)).products[0];
    expect(product.facts.map((citation) => citation.quote)).toEqual([identity, fact]);
    expect(product.unresolvedConstraints).toContain(unknownBattery);
  });

  it("does not count an omitted native battery locator as displayed evidence", async () => {
    const payload = structuredClone(capturedReplay);
    payload.output.content.observations[0].quotedFacts = ["45 mm large aperture drivers"];
    const product = (await research(payload)).products.find((item) => item.name === ath.name)!;
    expect(product.facts.map((citation) => citation.quote)).toEqual([ath.driver]);
    expect(product.unresolvedConstraints).toContain(unknownBattery);
  });

  it("keeps identity-only battery uncertainty after a rejected native designation", async () => {
    const payload = structuredClone(capturedReplay);
    payload.output.content.observations[0].name = "Other Model";
    const product = (await research(payload)).products.find((item) => item.name === ath.name)!;
    expect(product.facts).toEqual([]);
    expect(product.unresolvedConstraints).toContain(unknownBattery);
  });

  it.each(["headphones", "laptops"] as const)("keeps hard-only requested %s runtime separate from qualitative feature verification", async (category) => {
    const preferences = requested(category);
    preferences.soft.priorities = [];
    preferences.hard.requiredFeatures = [category === "headphones" ? "long-battery-life" : "long-battery"];
    const fact = `These ${category} have long battery life.`;
    const product = (await research(synthetic(fact, [fact], category), preferences)).products[0];
    expect(product.unresolvedConstraints).toContain(unknownBattery);
    expect(product.unresolvedConstraints).toContain(`${preferences.hard.requiredFeatures[0].replaceAll("-", " ")} needs independent verification`);
  });

  it("adds no battery-specific uncertainty when no battery comparison was requested", async () => {
    const preferences = requested();
    preferences.soft.priorities = [];
    const product = (await research(synthetic("Driver size: 42 mm.", ["Driver size: 42 mm."]), preferences)).products[0];
    expect(product.facts.map((citation) => citation.quote)).toEqual(["Driver size: 42 mm."]);
    expect(product.unresolvedConstraints).not.toContain(unknownBattery);
  });

  it.each(["...", "## Related products", "# Other Model"])("does not restore battery meaning across boundary %s", async (boundary) => {
    const fact = "These headphones have 30 hours of playback.";
    const product = (await research(synthetic(`Driver size: 42 mm.\n${boundary}\n${fact}`, [fact]))).products[0];
    expect(product.facts).toEqual([]);
    expect(product.unresolvedConstraints).toContain(unknownBattery);
  });

  it("keeps a dropped fourth battery fact unknown and recognizes the retained third counterpart", async () => {
    const facts = ["Driver size: 42 mm.", "Weight: 200 g.", "Supports Bluetooth.", "Battery life: 40 hours."];
    const payload = synthetic(facts.join("\n"), facts.slice(0, 3));
    payload.output.content.observations.push({ ...payload.output.content.observations[0], quotedFacts: [facts[3]] });
    const dropped = (await research(payload)).products[0];
    expect(dropped.facts.map((citation) => citation.quote)).toEqual(facts.slice(0, 3));
    expect(dropped.unresolvedConstraints).toContain(unknownBattery);
    const retained = (await research(synthetic(facts.join("\n"), [facts[0], facts[1], facts[3]]))).products[0];
    expect(retained.facts.map((citation) => citation.quote)).toEqual([facts[0], facts[1], facts[3]]);
    expect(retained.unresolvedConstraints).not.toContain(unknownBattery);
  });

  it("deduplicates retained runtime facts without losing their meaning", async () => {
    const fact = "Battery life: 40 hours.";
    const payload = synthetic(fact, [fact, fact]);
    payload.output.content.observations.push(structuredClone(payload.output.content.observations[0]));
    const product = (await research(payload)).products[0];
    expect(product.facts.map((citation) => citation.quote)).toEqual([fact]);
    expect(product.unresolvedConstraints).not.toContain(unknownBattery);
  });

  it("requires whole qualifying support to fit before clearing battery uncertainty", async () => {
    const payload = structuredClone(capturedReplay);
    payload.results = [payload.results[0]];
    payload.output.content.observations = [{ ...nativeObservations[0], identityQuote: ath.name, quotedFacts: [ath.battery] }];
    const topic = `# ${ath.name}\n${ath.category}\n${ath.microphone}\n`;
    payload.results[0].highlights = [topic + ath.controls + "\n" + ath.battery];
    const accepted = (await research(payload)).products[0];
    expect(accepted.facts.map((citation) => citation.quote)).toEqual([ath.battery]);
    expect(accepted.unresolvedConstraints).not.toContain(unknownBattery);
    payload.results[0].highlights = [topic + ath.controls.replace("Amazon Alexa", "Very ".repeat(80) + "Alexa") + "\n" + ath.battery];
    const dropped = (await research(payload)).products[0];
    expect(dropped.facts).toEqual([]);
    expect(dropped.unresolvedConstraints).toContain(unknownBattery);
  });

  it("rejects an actual scan-cut battery prefix but accepts the corresponding genuine EOF", async () => {
    const fact = "Battery life: 40 hours";
    const payload = synthetic(fact, [fact]);
    const accepted = (await research(payload)).products[0];
    expect(accepted.facts.map((citation) => citation.quote)).toEqual([fact]);
    expect(accepted.unresolvedConstraints).not.toContain(unknownBattery);
    const prefix = payload.results[0].highlights[0];
    payload.results[0].highlights[0] = prefix + " ".repeat(16384 - prefix.length) + " for another model.";
    const dropped = (await research(payload)).products[0];
    expect(dropped.facts).toEqual([]);
    expect(dropped.unresolvedConstraints).toContain(unknownBattery);
  });

  it("keeps the maximum current preference shape within the unchanged sixteen-note limit", async () => {
    const preferences = requested();
    preferences.hard.requiredFeatures = ["active-noise-cancelling", "wireless", "multipoint", "long-battery-life", "lightweight"];
    preferences.hard.excludedBrands = ["Unrelated Brand"];
    const snapshot = await research(capturedReplay, preferences);
    const product = snapshot.products.find((item) => item.name === "Edifier WH950NB (2025 edition) Wireless Noise Cancelling Headphone")!;
    expect(product.unresolvedConstraints).toContain(unknownBattery);
    expect(product.unresolvedConstraints).toContain("Manufacturer identity and brand exclusions need independent verification");
    expect(product.unresolvedConstraints).toContain("Current affordability within SGD 400 is unverified");
    expect(product.unresolvedConstraints).toContain("Stock and delivery to SG are unverified");
    expect(product.unresolvedConstraints).toHaveLength(9);
    expect(product.unresolvedConstraints.length).toBeLessThanOrEqual(16);
  });
});
