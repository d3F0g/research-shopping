import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { defaultPreferences, FeatureSchema, type Feature } from "../../src/domain/contracts";
import { ApplicationTurnResponseSchema } from "../../src/domain/research";
import { createApp } from "../../src/server/app";
import { createExaProductResearch } from "../../src/server/exa-research";
import { createResearchTurns } from "../../src/server/research-turns";
import { adverseClass, adverseFeatures, adverseHeading, adverseName, adversePayload, adversePriceConditions, wirelessNegatives } from "../fixtures/adverse-evidence";

async function research(payload: ReturnType<typeof adversePayload>, feature?: Feature, brands: string[] = []) {
  const requests: { path: string | undefined; body: Record<string, unknown> }[] = [];
  const settlements: { cost: number | null; complete: boolean }[] = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    requests.push({ path: request.url, body: JSON.parse(body) });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(payload));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const preferences = defaultPreferences();
  preferences.hard.category = feature ? adverseFeatures[feature].category : "headphones";
  preferences.hard.budget = { amount: 400, currency: "SGD" };
  preferences.hard.requiredFeatures = feature ? [feature] : [];
  preferences.hard.excludedBrands = brands;
  try {
    const app = createApp({ researchTurns: createResearchTurns({
      research: createExaProductResearch("fake-key-local-only", { baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }),
      quota: { async reserve() { return "admitted"; }, async settle(_id, cost, complete) { settlements.push({ cost, complete }); } },
    }) }, { apiPort: 6395, webPort: 6396 });
    const response = await app.request("http://127.0.0.1:6395/api/turn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: `${preferences.hard.category} under SGD400`, preferences, operationId: randomUUID() }) });
    expect(response.status).toBe(200);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ path: "/search", body: { numResults: 5, contents: { highlights: true } } });
    expect(settlements).toEqual([{ cost: 0.007, complete: true }]);
    const result = ApplicationTurnResponseSchema.parse(await response.json());
    expect(result.kind).toBe("research");
    if (result.kind !== "research") throw new Error("Expected research fixture result");
    expect(result.preferences).toEqual(preferences);
    return result.research;
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const paths = ["heading", "direct"] as const;
const identity = (path: typeof paths[number]) => path === "heading" ? adverseHeading : adverseClass;
function featurePayload(feature: Feature, path: typeof paths[number], highlights: string[]) {
  const payload = adversePayload(path, highlights);
  if (adverseFeatures[feature].category === "laptops") {
    payload.results[0].highlights = highlights.map((text) => text.replaceAll("Wireless over-ear headphones", "Laptop").replaceAll("a pair of wireless headphones", "a laptop"));
    payload.output.content.observations[0].quotedFacts = path === "direct" ? ["Aster Wave 2 is a laptop."] : [];
  }
  return payload;
}

describe("literal feature oracles through the SDK, local HTTP and Hono", () => {
  it("covers every current feature with independently authored fixture statements", () => {
    expect(Object.keys(adverseFeatures).sort()).toEqual([...FeatureSchema.options].sort());
  });
  for (const feature of FeatureSchema.options) {
    const row = adverseFeatures[feature];
    for (const path of paths) {
      it(`${feature} ${path} preserves omitted positives as unresolved and omits no known negative`, async () => {
        const positive = await research(featurePayload(feature, path, [identity(path), `${adverseName} ${row.positive}`]), feature);
        expect(positive.products).toHaveLength(1);
        expect(positive.products[0].facts.map((fact) => fact.quote)).toEqual(path === "direct" ? [row.category === "laptops" ? "Aster Wave 2 is a laptop." : adverseClass] : []);
        expect(positive.products[0].unresolvedConstraints).toContain(`${feature.replaceAll("-", " ")} needs independent verification`);
        for (const highlights of [[`${identity(path)}\n${adverseName} ${row.negative}`], [identity(path), `${adverseName} ${row.negative}`]]) {
          expect((await research(featurePayload(feature, path, highlights), feature)).products).toEqual([]);
        }
      });
      it(`${feature} ${path} keeps foreign, longer variant, comparative and unbound pronoun evidence separate`, async () => {
        for (const statement of [`Orbit Quiet ${row.negative}`, `${adverseName} Pro ${row.negative}`, row.pronoun, `${adverseName} ${row.negative.replace(/\.$/, "")} for Orbit Quiet.`, `${adverseName} ${row.negative.replace(/\.$/, "")} for another model.`, `${adverseName} ${row.positive.replace(/\.$/, "")} while Orbit Quiet ${row.negative}`]) {
          const result = await research(featurePayload(feature, path, [identity(path), statement]), feature);
          expect(result.products, statement).toHaveLength(1);
        }
      });
      it(`${feature} ${path} distinguishes intact inherited scope from unbound labels and pronouns`, async () => {
        for (const negative of [`${row.label}: No`, `${row.label}: False`, `${row.label}: Not supported`, `${row.label}: Unavailable`, row.pronoun]) {
          const result = await research(featurePayload(feature, path, [`${identity(path)}\n${negative}`]), feature);
          expect(result.products, negative).toHaveLength(path === "heading" ? 0 : 1);
        }
      });
    }
  }
  it.each(wirelessNegatives)("preserves the recognized negative in both identity paths: %s", async (clause) => {
    for (const path of paths) expect((await research(adversePayload(path, [identity(path), `${adverseName} ${clause}`]), "wireless")).products).toEqual([]);
  });
  it.each(["Connectivity: wired-only", "Connectivity: wired only"])("applies the exclusive connectivity label inside a heading: %s", async (label) => {
    expect((await research(adversePayload("heading", [`${adverseHeading}\n${label}`]), "wireless")).products).toEqual([]);
  });
});

describe("source-local assessment before output limits", () => {
  it.each([[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]])("is absorbing across all three matching-scope orders %j", async (...order) => {
    const scopes = [adverseHeading + "\nWireless: Yes", adverseHeading + "\nWireless: No", adverseHeading + "\nDriver size: 42 mm."];
    expect((await research(adversePayload("heading", order.map((index) => scopes[index])), "wireless")).products).toEqual([]);
  });
  it.each(["Orbit Quiet", "Orbit Quiet: no Bluetooth.", "Specifications for Orbit Quiet", "Pro variant", "...", "## Related products", "# Orbit Quiet"])("ends inheritance at %s but still assesses a complete exact statement", async (boundary) => {
    const text = `${adverseHeading}\n${boundary}\nWireless: No\nThese headphones are not wireless.`;
    expect((await research(adversePayload("heading", [text]), "wireless")).products).toHaveLength(1);
    expect((await research(adversePayload("heading", [text + `\n${adverseName} has no wireless support.`]), "wireless")).products).toEqual([]);
  });
  it("does not borrow positive facts or prices from a secondary matching scope", async () => {
    const payload = adversePayload("heading", [adverseHeading, adverseHeading + "\nDriver size: 42 mm.\nPrice: SGD 349"], { facts: ["Driver size: 42 mm."], price: "Price: SGD 349" });
    expect((await research(payload)).products[0]).toMatchObject({ facts: [], price: null });
  });
  it("assesses beyond three excerpts, 640 visible characters and three native facts", async () => {
    const facts = ["Driver size: 42 mm.", "Weight: 250 g.", "Battery life: 60 hours."];
    const payload = adversePayload("heading", [`${adverseHeading}\n${facts.join("\n")}\n${"Weight: 250 g.\n".repeat(60)}`, "Unbound text.", "Unbound text.", `${adverseName} has no wireless support.`], { facts });
    expect((await research(payload, "wireless")).products).toEqual([]);
    const positive = await research({ ...payload, results: [{ ...payload.results[0], highlights: payload.results[0].highlights.slice(0, 3) }] }, "wireless");
    expect(positive.products[0].facts).toHaveLength(3);
    expect(positive.sources[0].highlights.length).toBeLessThanOrEqual(3);
    expect(positive.sources[0].highlights.every((text) => text.length <= 640)).toBe(true);
  });
  it("keeps six retained highlights and the 16,384 character scan limit exact", async () => {
    const negative = `${adverseName} has no wireless support.`;
    const six = [adverseHeading, "Context", "Context", "Context", "Context", negative];
    expect((await research(adversePayload("heading", six), "wireless")).products).toEqual([]);
    expect((await research(adversePayload("heading", [...six.slice(0, 5), "Context", negative]), "wireless")).products).toHaveLength(1);
    const prefix = `${adverseHeading}\n`;
    const inside = prefix + " ".repeat(16384 - prefix.length - negative.length) + negative;
    const outside = prefix + " ".repeat(16384 - prefix.length) + negative;
    expect((await research(adversePayload("heading", [inside]), "wireless")).products).toEqual([]);
    expect((await research(adversePayload("heading", [outside]), "wireless")).products).toHaveLength(1);
  });
  it("assesses every bounded source before name deduplication and the product cap", async () => {
    const payload = adversePayload("heading", [adverseHeading]);
    payload.results = Array.from({ length: 6 }, (_, index) => ({ url: `https://reviews.example.com/fixture-${index}`, title: `Aster Wave ${index} | Synthetic fixture`, highlights: [`# Aster Wave ${index}\nWireless over-ear headphones`, ...(index === 4 ? ["Aster Wave 4 has no wireless support."] : [])] }));
    const result = await research(payload, "wireless");
    expect(result.sources).toHaveLength(5);
    expect(result.products.map((product) => product.name)).toEqual(["Aster Wave 0", "Aster Wave 1", "Aster Wave 2", "Aster Wave 3"]);
    const duplicate = adversePayload("heading", [adverseHeading, "Aster Wave 2 has no wireless support."]);
    duplicate.results.push({ ...duplicate.results[0], url: "https://reviews.example.com/independent-fixture", highlights: [adverseHeading] });
    expect((await research(duplicate, "wireless")).products[0].identity.sourceId).toBe("source-2");
    duplicate.results.reverse();
    expect((await research(duplicate, "wireless")).products[0].identity.sourceId).toBe("source-1");
  });
});

describe("affirmative manufacturer evidence", () => {
  it("uses exact title and designation brand relations without substring matches", async () => {
    for (const [title, expected] of [["Bose Aster Wave 2 | Synthetic fixture", 0], ["Bosecraft Aster Wave 2 | Synthetic fixture", 1], ["Aster Wave 2 | Bose comparison fixture", 1]] as const) {
      expect((await research(adversePayload("direct", [adverseClass], { title }), undefined, ["Bose"])).products).toHaveLength(expected);
    }
    for (const [name, expected] of [["Bose Wave 2", 0], ["Bosecraft Wave 2", 1]] as const) {
      const payload = adversePayload("heading", [`# ${name}\nWireless over-ear headphones`], { name, title: `${name} | Synthetic fixture` });
      expect((await research(payload, undefined, ["Bose"])).products).toHaveLength(expected);
    }
  });
  for (const path of paths) for (const verb of ["made", "manufactured"]) {
    it(`${path} keeps ${verb}-by polarity, ownership and uncertainty`, async () => {
      for (const [statement, expected] of [["", 1], [`Aster Wave 2 is ${verb} by Bose.`, 0], [`Aster Wave 2 is not ${verb} by Bose.`, 1], [`Orbit Quiet is ${verb} by Bose.`, 1], [`Aster Wave 2 Pro is ${verb} by Bose.`, 1], [`Aster Wave 2 might be ${verb} by Bose.`, 1], [`Aster Wave 2 is ${verb} by Bose?`, 1]] as const) {
        const result = await research(adversePayload(path, [identity(path), statement]), undefined, ["Bose"]);
        expect(result.products, statement).toHaveLength(expected);
        if (expected) expect(result.products[0].unresolvedConstraints).toContain("Manufacturer identity and brand exclusions need independent verification");
      }
    });
  }
});

describe("full retained price applicability", () => {
  it("withholds a selected amount when a second matching scope leaves its applicability unresolved", async () => {
    const price = "Price: SGD 349";
    const text = `${adverseHeading}\n${price}`;
    expect((await research(adversePayload("heading", [text, `${adverseHeading}\nPrice: SGD 299`], { price }))).products[0].price).toBeNull();
    expect((await research(adversePayload("direct", [adverseClass, "Aster Wave 2 costs SGD 349.", "Aster Wave 2 costs SGD 299."], { price: "Aster Wave 2 costs SGD 349." }))).products[0].price).toBeNull();
  });
  it("does not transfer unbound leading conditions across an intervening product or gap", async () => {
    for (const boundary of ["Orbit Quiet", "..."]) {
      const text = `With trade-in of a qualifying device.\n${boundary}\n${adverseHeading}\nPrice: SGD 349`;
      expect((await research(adversePayload("heading", [text], { price: "Price: SGD 349" }))).products[0].price?.quote).toBe("Price: SGD 349");
    }
  });
  for (const path of paths) for (const condition of adversePriceConditions) {
    it(`${path} withholds ${condition} across own facts, class statements and section headings`, async () => {
      const price = path === "heading" ? "Price: SGD 349" : "Aster Wave 2 costs SGD 349.";
      for (const bridge of ["Aster Wave 2 supports Bluetooth.", adverseClass, "## Specifications"]) {
        for (const text of [`${identity(path)}\n${price}\n${bridge}\n${condition}`, `${condition}\n${identity(path)}\n${bridge}\n${price}`, `${identity(path)}\n${condition}\n${bridge}\n${price}`]) {
          expect((await research(adversePayload(path, [text], { price }))).products[0].price, text).toBeNull();
        }
      }
    });
  }
  for (const path of paths) it(`${path} pairs exact-model cross-highlight conditions with foreign and unconditional controls`, async () => {
    const price = path === "heading" ? "Price: SGD 349" : "Aster Wave 2 costs SGD 349.";
    const base = `${identity(path)}\n${price}`;
    for (const highlights of [[base], [base, "With trade-in of a qualifying device."], [`${base}\n...\nWith trade-in of a qualifying device.`], [`Orbit Quiet requires trade-in.\n${base}`], [`${base}\nOrbit Quiet requires trade-in.`], [base, "Aster Wave 2 Pro requires trade-in."]]) {
      expect((await research(adversePayload(path, highlights, { price }))).products[0].price?.quote, highlights.join("\n")).toBe(price);
    }
    expect((await research(adversePayload(path, [base, "Aster Wave 2 requires trade-in."], { price }))).products[0].price).toBeNull();
    expect((await research(adversePayload(path, [base, adverseClass + "\nWith trade-in of a qualifying device."], { price }))).products[0].price).toBeNull();
    expect((await research(adversePayload(path, [base + "\nUnknown applicability."], { price }))).products[0].price).toBeNull();
  });
});
