import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { defaultPreferences } from "../../src/domain/contracts";
import { ApplicationTurnResponseSchema, ResearchSnapshotSchema } from "../../src/domain/research";
import { createApp } from "../../src/server/app";
import { createExaProductResearch } from "../../src/server/exa-research";
import { createResearchTurns } from "../../src/server/research-turns";
import { ath, capture, capturedReplay, nativeObservations, normalized } from "../fixtures/native-alignment";

async function replay(payload: unknown) {
  const requests: Array<{ path: string | undefined; body: { numResults: number; contents: unknown } }> = [];
  const settlements: unknown[] = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    requests.push({ path: request.url, body: JSON.parse(body) });
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
  const preferences = defaultPreferences();
  preferences.hard.category = "headphones";
  preferences.hard.budget = { amount: 400, currency: "SGD" };
  const app = createApp({ researchTurns: createResearchTurns({
    research: createExaProductResearch("fake-automated-capture-key", { baseUrl }),
    quota: {
      async reserve() { return "admitted"; },
      async settle(_operation, cost, complete) { settlements.push({ cost, complete }); },
    },
  }) }, { apiPort: 6363, webPort: 6364 });
  try {
    const response = await app.request("http://127.0.0.1:6363/api/turn", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Headphones for music under SGD400. Compare sound quality and battery life.", preferences, operationId: randomUUID() }),
    });
    expect(response.status).toBe(200);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ path: "/search", body: { numResults: 5, contents: { highlights: {} } } });
    expect(settlements).toEqual([{ cost: 0.007, complete: true }]);
    const result = ApplicationTurnResponseSchema.parse(await response.json());
    expect(result.kind).toBe("research");
    if (result.kind !== "research") throw new Error("Expected captured source research");
    ResearchSnapshotSchema.parse(result.research);
    return result.research;
  } finally {
    globalThis.fetch = originalFetch;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function syntheticAth(text: string, changes: Partial<(typeof nativeObservations)[number]> = {}) {
  return {
    ...structuredClone(capturedReplay),
    results: [{ ...capturedReplay.results[0], highlights: [text] }],
    output: { content: { observations: [{ ...nativeObservations[0], identityQuote: ath.name, ...changes }] } },
  };
}
const topic = `# ${ath.name}\n${ath.category}`;
const chain = `${topic}\n${ath.microphone}\n${ath.controls}\n${ath.battery}`;
const quoted = (snapshot: Awaited<ReturnType<typeof replay>>) => snapshot.products.flatMap((product) => product.facts.map((fact) => fact.quote));

it("verifies every exact native, title, URL and highlight field before using the derived envelope", () => {
  const fields = [capture.fields.native, ...capture.fields.results.flatMap((source) => [source.title, source.url, ...source.highlights])];
  expect(fields).toHaveLength(16);
  for (const field of fields) {
    expect(field.truncated).toBe(false);
    expect(field.text.length).toBe(field.originalLength);
    expect(Buffer.byteLength(field.text)).toBe(field.originalBytes);
    expect(createHash("sha256").update(field.text).digest("hex")).toBe(field.sha256);
  }
  expect(nativeObservations).toHaveLength(4);
});

it("projects the exact captured useful claims with every required contiguous support window", async () => {
  const snapshot = await replay(capturedReplay);
  const product = snapshot.products.find((item) => item.name === ath.name)!;
  expect(product.identity).toMatchObject({ kind: "direct-model-statement", quote: ath.category });
  expect(product.facts.map((fact) => fact.quote)).toEqual([ath.battery, ath.driver]);
  const edifier = snapshot.products.find((item) => item.name === "Edifier WH950NB (2025 edition) Wireless Noise Cancelling Headphone")!;
  expect(edifier.facts.map((fact) => fact.quote)).toEqual(["Titanium-coated 40mm drivers deliver powerful, balanced sound."]);
  expect(edifier.price).toBeNull();
  const teal = snapshot.products.find((item) => item.name.endsWith("Teal (800073)"))!;
  expect(teal.facts).toEqual([]);
  expect(teal.price).toMatchObject({ kind: "page-price-context-unverified", quote: "S$ 349 was S$ 499 SGD You Save S$ 150" });
  for (const [source, start, end, length] of [[0, 106, 400, 292], [0, 1212, 1756, 543], [3, 0, 270, 267], [2, 0, 117, 106]]) {
    const support = normalized(capture.fields.results[source].highlights[0].text.slice(start, end));
    expect(support.length).toBe(length);
    expect(snapshot.sources[source].highlights).toContain(support);
  }
  expect(snapshot.products.some((item) => /Sony|Graphite/i.test(item.name))).toBe(false);
  expect(quoted(snapshot).join(" ")).not.toMatch(/80 hours|60 hours|LDAC|AAC/);
  expect(snapshot.products.find((item) => item.name === "Sennheiser Momentum 4 Wireless Headphone")).toMatchObject({ facts: [], price: null });
  for (const product of snapshot.products) {
    expect(product.stock).toBe("unverified");
    expect(product.unresolvedConstraints.join(" ")).toContain("affordability within SGD 400 is unverified");
  }
  expect(snapshot.sources.every((source) => source.highlights.length <= 3 && source.highlights.every((window) => window.length <= 640))).toBe(true);
});

describe("synthetic paired controls derived from captured wording", () => {
  it.each(["Orion-X9", "Boreal Studio 2"])("owns the same recognized records independently of captured model %s", async (name) => {
    const payload = syntheticAth(chain.replace(ath.category, `${ath.category} ${ath.driver}`), { name, identityQuote: name, quotedFacts: ["45 mm large aperture drivers", "battery life of up to 50 hours"] });
    payload.results[0].title = `${name} | Wireless Over-Ear Headphones | Synthetic fixture`;
    payload.results[0].highlights[0] = payload.results[0].highlights[0].replaceAll(ath.name, name);
    expect(quoted(await replay(payload))).toEqual([ath.driver, ath.battery]);
  });
  it.each(["Pro", "Black", "2026", "64 GB", "Other Model"])("does not discard an en-dash product/title qualifier %s", async (qualifier) => {
    const payload = syntheticAth(chain);
    payload.results[0].title = `${ath.name} – ${qualifier}`;
    expect((await replay(payload)).products).toEqual([]);
  });
  it("recognizes complete organization title metadata while retaining the full source designation", async () => {
    const payload = syntheticAth(chain, { name: `${ath.name} – Example Audio Ltd`, quotedFacts: [ath.battery] });
    payload.results[0].title = `${ath.name} – Example Audio Ltd`;
    expect(quoted(await replay(payload))).toEqual([ath.battery]);
    payload.results[0].title += " extra".repeat(50);
    expect((await replay(payload)).products).toEqual([]);
  });
  it("does not mistake singular category-only wording for a model designation", async () => {
    const payload = syntheticAth("# Wireless Headphone\nPrice: SGD 349", { name: "Wireless Headphone", identityQuote: "Wireless Headphone", quotedFacts: [] });
    payload.results[0].title = "Wireless Headphone";
    expect((await replay(payload)).products).toEqual([]);
  });
  it.each(["ATH-M50xBT2 Pro", "ATH-M50xBT2 Black", "Other Model", "ATH-M50xBT2 | Wrong publisher"])("vetoes contradictory native designation %s", async (name) => {
    expect(quoted(await replay(syntheticAth(chain, { name })))).toEqual([]);
  });
  it.each([null, "ATH-M50x", "ATH-M50xBT2 Pro", "ATH-M50xBT2 invented text"])("requires a resolved whole identity proposal %s", async (identityQuote) => {
    expect(quoted(await replay(syntheticAth(chain, { identityQuote })))).toEqual([]);
  });
  it("keeps independently proved identity-only leads when positive hints are omitted", async () => {
    const payload = syntheticAth(chain, { quotedFacts: [] });
    expect((await replay(payload)).products[0]).toMatchObject({ name: ath.name, facts: [] });
  });
  it("requires the complete category quotation for the legacy null-identity route", async () => {
    const full = await replay(syntheticAth(chain, { identityQuote: null, name: ath.name, quotedFacts: [ath.category, ath.battery] }));
    expect(quoted(full)).toEqual([ath.category, ath.battery]);
    expect(quoted(await replay(syntheticAth(chain, { identityQuote: null, name: ath.name, quotedFacts: ["wireless over-ear headphones", ath.battery] })))).toEqual([]);
  });
  it("cannot replace category proof with an exact-model microphone statement", async () => {
    expect((await replay(syntheticAth(chain.replace(ath.category, "")))).products).toEqual([]);
  });
  it.each(["", "\n", "\r\n"])("retains complete driver assertion and its comparison with separator %j", async (separator) => {
    const text = `${topic}${separator || " "}${ath.driver}`;
    expect(quoted(await replay(syntheticAth(text, { quotedFacts: ["45 mm large aperture drivers"] })))).toEqual([ath.driver]);
  });
  it.each([
    ath.driver.replace("These headphones feature", "Other Model features"),
    ath.driver.replace("These headphones feature", "These headphones do not feature"),
    ath.driver.replace("These headphones feature", "If these headphones feature"),
    ath.driver.replace("These headphones feature", "Do these headphones feature").replace(/\.$/, "?"),
    "Compared with Other Model, these headphones feature 45 mm large aperture drivers in a wireless design.",
    "Replacement pads for these headphones feature 45 mm large aperture drivers in a wireless design.",
  ])("does not turn a cropped driver hint into own positive evidence: %s", async (text) => {
    expect(quoted(await replay(syntheticAth(`${topic}\n${text}`, { quotedFacts: ["45 mm large aperture drivers"] })))).toEqual([]);
  });
  it.each([
    "Unknown marketing prose.", "Other Model has controls.", "With trade-in of a qualifying device.",
    "Do users have controls?", "Accessories", "...", "…", "## Specifications", "# Other Model",
  ])("cannot continue the microphone/control/battery topic across %s", async (barrier) => {
    const text = `${topic}\n${ath.microphone}\n${barrier}\n${ath.controls}\n${ath.battery}`;
    expect(quoted(await replay(syntheticAth(text, { quotedFacts: ["battery life of up to 50 hours"] })))).toEqual([]);
  });
  it.each([
    "Additionally, users enjoy listening to music.",
    ath.controls.replace("users can", "Other Model users can"),
    ath.controls.replace("users can", "users might"),
    ath.controls.replace("users can", "users cannot"),
    ath.controls.replace(/\.$/, "?"),
  ])("does not accept arbitrary or foreign functional continuation: %s", async (control) => {
    expect(quoted(await replay(syntheticAth(chain.replace(ath.controls, control), { quotedFacts: ["battery life of up to 50 hours"] })))).toEqual([]);
  });
  it("does not infer a missing support anchor or publish overlong support", async () => {
    expect(quoted(await replay(syntheticAth(`${topic}\nUnknown prose.\n${ath.controls}\n${ath.battery}`, { quotedFacts: [ath.battery] })))).toEqual([]);
    const expanded = ath.controls.replace("Amazon Alexa", "Very ".repeat(80) + "Alexa");
    expect(quoted(await replay(syntheticAth(chain.replace(ath.controls, expanded), { quotedFacts: [ath.battery] })))).toEqual([]);
  });
  it("does not stitch support across highlights or promote an incomplete scan prefix", async () => {
    const payload = syntheticAth(`${topic}\n${ath.microphone}\n${ath.controls}`, { quotedFacts: [ath.battery] });
    payload.results[0].highlights.push(ath.battery);
    expect(quoted(await replay(payload))).toEqual([]);
    const prefix = chain.replace(/\.$/, "");
    const padding = " ".repeat(16384 - prefix.length);
    expect(quoted(await replay(syntheticAth(prefix + padding + " for another model.", { quotedFacts: [ath.battery.replace(/\.$/, "")] })))).toEqual([]);
    expect(quoted(await replay(syntheticAth(prefix, { quotedFacts: [ath.battery.replace(/\.$/, "")] })))).toEqual([ath.battery.replace(/\.$/, "")]);
  });
  it.each(["\n", "\r\n"])("retains the complete functional support across %j line wrapping", async (newline) => {
    const text = chain.replaceAll("\n", newline);
    expect(quoted(await replay(syntheticAth(text, { quotedFacts: ["Battery life of up to 50 hours on a continuous full charge"] })))).toEqual([ath.battery]);
  });
  it("does not select a shared phrase under an explicitly different subject", async () => {
    const text = `${topic}\nUnknown prose.\n# Other Model\nThese headphones feature 45 mm large aperture drivers in a wireless design.`;
    expect(quoted(await replay(syntheticAth(text, { quotedFacts: ["45 mm large aperture drivers"] })))).toEqual([]);
  });
  it.each(["S$ 349", "You Save S$ 150", "was S$ 499", "S$ 499"])("rejects an incomplete price-role locator %s", async (priceQuote) => {
    const payload = structuredClone(capturedReplay);
    payload.output.content.observations[2].priceQuote = priceQuote;
    expect((await replay(payload)).products.find((product) => product.name.endsWith("Teal (800073)"))?.price).toBeNull();
  });
  it.each(["With trade-in of a qualifying device.", "## Terms\nMembers only."])("keeps a full price cluster conditional with %s", async (condition) => {
    const payload = structuredClone(capturedReplay);
    payload.results[2].highlights[0] = payload.results[2].highlights[0].replace("\n\n...", `\n${condition}\n\n...`);
    expect((await replay(payload)).products.find((product) => product.name.endsWith("Teal (800073)"))?.price).toBeNull();
  });
});
