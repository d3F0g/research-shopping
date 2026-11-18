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
import { adverseClass, adverseFeatures, adverseHeading, adverseName, adversePayload, adversePriceConditions, featurePropertyFixtures, wirelessNegatives } from "../fixtures/adverse-evidence";

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
    const open = `${adverseHeading}\n${boundary}\nWireless: No\nThese headphones are not wireless.`;
    const unproven = ["Orbit Quiet", "Specifications for Orbit Quiet", "Pro variant", "..."].includes(boundary);
    if (unproven) expect((await research(adversePayload("heading", [open]), "wireless")).products).toEqual([]);
    const text = unproven ? open.replace("Wireless over-ear headphones\n", "Wireless over-ear headphones.\n") : open;
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
    expect((await research(adversePayload("heading", [outside]), "wireless")).products).toEqual([]);
    const closedPrefix = `${adverseHeading}.\n`;
    const closedOutside = closedPrefix + " ".repeat(16384 - closedPrefix.length) + negative;
    expect((await research(adversePayload("heading", [closedOutside]), "wireless")).products).toHaveLength(1);
    const retained = outside.slice(0, 16384);
    expect((await research(adversePayload("heading", [retained]), "wireless")).products).toHaveLength(1);
    expect((await research(adversePayload("heading", [retained + "cases."]), "wireless")).products).toEqual([]);
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
  it.each(["made", "manufactured"])("requires a complete category before a foreign %s-by statement", async (verb) => {
    const open = `${adverseHeading}\nOrbit Quiet is ${verb} by Bose.`;
    expect((await research(adversePayload("heading", [open]), undefined, ["Bose"])).products).toEqual([]);
    const closed = open.replace("Wireless over-ear headphones\n", "Wireless over-ear headphones.\n");
    expect((await research(adversePayload("heading", [closed]), undefined, ["Bose"])).products).toHaveLength(1);
    expect((await research(adversePayload("heading", [closed.replace("Orbit Quiet", "Aster Wave 2")]), undefined, ["Bose"])).products).toEqual([]);
  });
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
      const provenIdentity = path === "heading" ? `${adverseHeading}.` : adverseClass;
      for (const bridge of ["Aster Wave 2 supports Bluetooth.", adverseClass, "## Specifications"]) {
        for (const text of [`${provenIdentity}\n${price}\n${bridge}\n${condition}`, `${condition}\n${provenIdentity}\n${bridge}\n${price}`, `${provenIdentity}\n${condition}\n${bridge}\n${price}`]) {
          const result = await research(adversePayload(path, [text], { price }));
          expect(result.products, text).toHaveLength(1);
          expect(result.products[0].price, text).toBeNull();
        }
        if (path === "heading") {
          const openPrefix = `${adverseHeading}\n${condition}\n${bridge}\n${price}`;
          expect((await research(adversePayload(path, [openPrefix], { price }))).products, openPrefix).toEqual([]);
        }
      }
    });
  }
  for (const path of paths) it(`${path} pairs exact-model cross-highlight conditions with foreign and unconditional controls`, async () => {
    const price = path === "heading" ? "Price: SGD 349" : "Aster Wave 2 costs SGD 349.";
    const base = `${identity(path)}\n${price}`;
    for (const highlights of [[base], [base, "With trade-in of a qualifying device."], [`${base}\n...\nWith trade-in of a qualifying device.`], [`Orbit Quiet requires trade-in.\n${base}`], [base, "Aster Wave 2 Pro requires trade-in."]]) {
      const result = await research(adversePayload(path, highlights, { price }));
      if (path === "heading" && highlights[0] === `${base}\n...\nWith trade-in of a qualifying device.`) {
        expect(result.products).toHaveLength(1);
        expect(result.products[0].price).toBeNull();
        const closed = `${base}\n## Specifications\n...\nWith trade-in of a qualifying device.`;
        expect((await research(adversePayload(path, [closed], { price }))).products[0].price?.quote).toBe(price);
        expect((await research(adversePayload(path, [closed + "\nAster Wave 2 requires trade-in."], { price }))).products[0].price).toBeNull();
      } else expect(result.products[0].price?.quote, highlights.join("\n")).toBe(price);
    }
    const foreignAfterAmount = await research(adversePayload(path, [`${base}\nOrbit Quiet requires trade-in.`], { price }));
    expect(foreignAfterAmount.products).toHaveLength(1);
    if (path === "heading") {
      expect(foreignAfterAmount.products[0].price).toBeNull();
      const closed = `${base}\n## Specifications\nOrbit Quiet requires trade-in.`;
      expect((await research(adversePayload(path, [closed], { price }))).products[0].price?.quote).toBe(price);
      expect((await research(adversePayload(path, [closed.replace("Orbit Quiet", "Aster Wave 2")], { price }))).products[0].price).toBeNull();
    } else expect(foreignAfterAmount.products[0].price?.quote).toBe(price);
    expect((await research(adversePayload(path, [base, "Aster Wave 2 requires trade-in."], { price }))).products[0].price).toBeNull();
    expect((await research(adversePayload(path, [base, adverseClass + "\nWith trade-in of a qualifying device."], { price }))).products[0].price).toBeNull();
    expect((await research(adversePayload(path, [base + "\nUnknown applicability."], { price }))).products[0].price).toBeNull();
  });
});

describe("whole feature propositions and outer polarity", () => {
  it("has independent whole-property and narrower-property fixtures for every feature", () => {
    expect(Object.keys(featurePropertyFixtures).sort()).toEqual([...FeatureSchema.options].sort());
  });
  for (const feature of FeatureSchema.options) for (const path of paths) {
    const { whole, narrower } = featurePropertyFixtures[feature];
    it(`${feature} ${path} excludes complete absence and leaves narrower or qualified absence unknown`, async () => {
      for (const predicate of [`does not have ${whole}.`, `is without ${whole}.`, `lacks ${whole}.`]) {
        expect((await research(featurePayload(feature, path, [identity(path), `${adverseName} ${predicate}`]), feature)).products).toEqual([]);
      }
      for (const property of [...narrower, `${whole} during calls`, `${whole} in one mode`, `${whole} and a carrying case`]) {
        for (const highlights of [[`${identity(path)}\n${adverseName} does not have ${property}.`], [identity(path), `${adverseName} does not have ${property}.`]]) {
          const result = await research(featurePayload(feature, path, highlights), feature);
          expect(result.products, property).toHaveLength(1);
          expect(result.products[0].facts).toHaveLength(path === "heading" ? 0 : 1);
          expect(result.products[0].unresolvedConstraints).toContain(`${feature.replaceAll("-", " ")} needs independent verification`);
        }
      }
    });
    it(`${feature} ${path} never turns an outer negation into an absence or affirmative support`, async () => {
      for (const predicate of [`is not without ${whole}.`, `isn't without ${whole}.`, `does not lack ${whole}.`, `has no lack of ${whole}.`, `does not have no ${whole}.`, `is no longer without ${whole}.`, `might not support ${whole}.`, `does not have ${whole}?`]) {
        const result = await research(featurePayload(feature, path, [`${identity(path)}\n${adverseName} ${predicate}`]), feature);
        expect(result.products, predicate).toHaveLength(1);
        expect(result.products[0].facts).toHaveLength(path === "heading" ? 0 : 1);
        expect(result.products[0].unresolvedConstraints).toContain(`${feature.replaceAll("-", " ")} needs independent verification`);
      }
    });
  }
  it.each(["wireless audio", "wireless connectivity", "wireless support", "a wireless connection", "any Bluetooth", "Bluetooth support"])("retains complete generic wireless-absence wording: %s", async (property) => {
    for (const path of paths) expect((await research(adversePayload(path, [identity(path), `${adverseName} does not have ${property}.`]), "wireless")).products).toEqual([]);
  });
  it("keeps scoped negated absence and narrower labels unknown", async () => {
    for (const text of ["These headphones are not without Bluetooth.", "Wireless charging: No", "Bluetooth LE Audio: No", "Wireless: Not unavailable"]) {
      const result = await research(adversePayload("heading", [`${adverseHeading}\n${text}`]), "wireless");
      expect(result.products).toHaveLength(1);
      expect(result.products[0].facts).toEqual([]);
      expect(result.products[0].unresolvedConstraints).toContain("wireless needs independent verification");
    }
  });
  it("does not complete a property proposition across an explicit source gap", async () => {
    for (const path of paths) {
      const payload = adversePayload(path, [`${identity(path)}\n${adverseName} does not have wireless ... charging.`]);
      expect((await research(payload, "wireless")).products).toHaveLength(1);
      payload.results[0].highlights = [`${identity(path)}\n${adverseName} does not have wireless. ... Other context.`];
      expect((await research(payload, "wireless")).products).toEqual([]);
    }
  });
  it("preserves the full source variant and does not apply a different variant's absence", async () => {
    const name = "Aster Wave 2 Pro - Teal (800073)";
    const payload = adversePayload("heading", [`# ${name}\nWireless over-ear headphones\n${name} does not have wireless charging.\nAster Wave 2 is not wireless.`], { name, title: `${name} | Synthetic fixture` });
    const result = await research(payload, "wireless");
    expect(result.products.map((product) => product.name)).toEqual([name]);
    payload.results[0].title = "Aster Wave 2 Pro - Black (800073) | Synthetic fixture";
    expect((await research(payload, "wireless")).products).toEqual([]);
  });
});

describe("price applicability across semantic heading roles", () => {
  for (const path of paths) {
    const amount = path === "heading" ? "Price: SGD 349" : "Aster Wave 2 costs SGD 349.";
    for (const heading of ["## With trade-in of a qualifying device", "# Terms", "###### Payment Details", "## Additional Information", "## Offer Conditions", "## limited purchase program"]) {
      it(`${path} preserves ${heading} before and after the amount`, async () => {
        for (const text of [`${identity(path)}\n${amount}\n${heading}\nWith trade-in of a qualifying device.`, `${identity(path)}\n${heading}\nWith trade-in of a qualifying device.\nAster Wave 2 supports Bluetooth.\n${amount}`, `${identity(path)}\n${amount}\n${heading}\nAster Wave 2 supports Bluetooth.\nWith trade-in of a qualifying device.`]) {
          const result = await research(adversePayload(path, [text], { price: amount }));
          expect(result.products).toHaveLength(1);
          expect(result.products[0].price).toBeNull();
          expect(result.sources[0].highlights.some((quote) => quote.includes(heading))).toBe(true);
        }
      });
    }
    it(`${path} keeps markdown condition headings themselves in the assessment`, async () => {
      for (const marker of ["#", "##", "######"]) {
        const text = `${identity(path)}\n${amount}\n${marker} With trade-in of a qualifying device`;
        expect((await research(adversePayload(path, [text], { price: amount }))).products[0].price).toBeNull();
      }
    });
    it(`${path} retains unconditional prices and isolates foreign headings, gaps and unrelated highlights`, async () => {
      const base = `${identity(path)}\n${amount}`;
      for (const highlights of [[base], [`${base}\n## Orbit Quiet\nWith trade-in of a qualifying device.`], [`${base}\n## Related products\nWith trade-in of a qualifying device.`], [`${base}\n## Aster Wave 2 Pro\nWith trade-in of a qualifying device.`], [`${base}\n## Aster Wave 2 - Teal (800073)\nWith trade-in of a qualifying device.`], [`${base}\n...\n## Terms\nWith trade-in of a qualifying device.`], [base, "## Terms\nWith trade-in of a qualifying device."], [`${base}\n## Orbit Quiet requires trade-in.`]]) {
        const result = await research(adversePayload(path, highlights, { price: amount }));
        if (path === "heading" && highlights[0] === `${base}\n...\n## Terms\nWith trade-in of a qualifying device.`) {
          expect(result.products).toHaveLength(1);
          expect(result.products[0].price).toBeNull();
          const closed = `${base}\n## Specifications\n...\n## Terms\nWith trade-in of a qualifying device.`;
          expect((await research(adversePayload(path, [closed], { price: amount }))).products[0].price?.quote).toBe(amount);
          expect((await research(adversePayload(path, [closed + "\nAster Wave 2 requires trade-in."], { price: amount }))).products[0].price).toBeNull();
        } else expect(result.products[0].price?.quote, highlights.join("\n")).toBe(amount);
      }
      expect((await research(adversePayload(path, [base, "## Aster Wave 2 requires trade-in."], { price: amount }))).products[0].price).toBeNull();
    });
  }
});

describe("actual scan completion through the product adapter", () => {
  for (const path of paths) {
    const prefix = `${identity(path)}\n`;
    const at = (text: string, length = 16384) => prefix + " ".repeat(length - prefix.length - text.length) + text;
    for (const length of [16383, 16384, 16385]) {
      it(`${path} distinguishes a returned EOF, an actual cut and a closed sentence at ${length}`, async () => {
        const absence = "Aster Wave 2 does not have wireless";
        expect((await research(adversePayload(path, [at(absence, length) + " charging."]), "wireless")).products).toHaveLength(1);
        expect((await research(adversePayload(path, [at(absence, length)]), "wireless")).products).toHaveLength(length <= 16384 ? 0 : 1);
        expect((await research(adversePayload(path, [at(absence + ".", length) + " Additional context."]), "wireless")).products).toHaveLength(length <= 16384 ? 0 : 1);
      });
    }
    it(`${path} keeps property continuations intact at newlines and inline markers`, async () => {
      for (const suffix of ["\ncharging.", "\nCharging.", " accessories [included items].", " accessories *included items*.", "\n## Accessories\nCase.", " ... charging."]) {
        const result = await research(adversePayload(path, [prefix + "Aster Wave 2 does not have wireless" + suffix]), "wireless");
        expect(result.products, suffix).toHaveLength(1);
        expect(result.products[0].unresolvedConstraints).toContain("wireless needs independent verification");
      }
      expect((await research(adversePayload(path, [prefix + "Aster Wave 2 does not have wireless.\n## Accessories\nCase."]), "wireless")).products).toEqual([]);
    });
    it(`${path} does not exclude an unfinished manufacturer or publish an unfinished positive fact`, async () => {
      const maker = "Aster Wave 2 is made by Bose";
      expect((await research(adversePayload(path, [at(maker) + "craft."]), undefined, ["Bose"])).products).toHaveLength(1);
      expect((await research(adversePayload(path, [at(maker)]), undefined, ["Bose"])).products).toEqual([]);
      expect((await research(adversePayload(path, [at(maker + ".", 16383) + " More context."]), undefined, ["Bose"])).products).toEqual([]);
      const fact = "Aster Wave 2 supports Bluetooth";
      for (const [text, quote, admitted] of [[at(fact) + " LE Audio.", fact, false], [at(fact), fact, true], [at(fact + ".", 16383) + " More context.", fact + ".", true]] as const) {
        const result = await research(adversePayload(path, [text], { facts: [...(path === "direct" ? [adverseClass] : []), quote] }));
        expect(result.products).toHaveLength(1);
        expect(result.products[0].facts.some((entry) => entry.quote === quote)).toBe(admitted);
      }
    });
    it(`${path} requires a complete price and retains open qualifiers as uncertainty`, async () => {
      const amount = path === "heading" ? "Price: SGD 349" : "Aster Wave 2 costs SGD 349";
      expect((await research(adversePayload(path, [at(amount) + " with trade-in."], { price: amount }))).products[0].price).toBeNull();
      expect((await research(adversePayload(path, [at(amount)], { price: amount }))).products[0].price?.quote).toBe(amount);
      const priced = prefix + amount + "\n";
      const qualifier = "With trade-in";
      const clipped = priced + " ".repeat(16384 - priced.length - qualifier.length) + qualifier + " of a qualifying device.";
      expect((await research(adversePayload(path, [clipped], { price: amount }))).products[0].price).toBeNull();
    });
    it(`${path} requires completion before proving the product category`, async () => {
      const open = path === "heading" ? adverseHeading : adverseClass.slice(0, -1);
      const atLimit = " ".repeat(16384 - open.length) + open;
      const facts = path === "direct" ? [open] : [];
      expect((await research(adversePayload(path, [atLimit + " case."], { facts }))).products).toEqual([]);
      expect((await research(adversePayload(path, [atLimit], { facts }))).products).toHaveLength(1);
    });
    it(`${path} withholds a price for an open exact-model qualifier in another retained highlight`, async () => {
      const amount = path === "heading" ? "Price: SGD 349" : "Aster Wave 2 costs SGD 349.";
      const qualifier = "Aster Wave 2 requires trade-in";
      const clipped = " ".repeat(16384 - qualifier.length) + qualifier + " of a qualifying device.";
      expect((await research(adversePayload(path, [prefix + amount, clipped], { price: amount }))).products[0].price).toBeNull();
      for (const foreign of ["Orbit Quiet requires trade-in", "Aster Wave 2 Pro requires trade-in"]) {
        const other = " ".repeat(16384 - foreign.length) + foreign + " of a qualifying device.";
        expect((await research(adversePayload(path, [prefix + amount, other], { price: amount }))).products[0].price?.quote).toBe(amount);
      }
    });
    it(`${path} cannot use a clipped heading to hide unresolved price context`, async () => {
      const amount = path === "heading" ? "Price: SGD 349" : "Aster Wave 2 costs SGD 349.";
      const priced = prefix + amount + "\n";
      for (const label of ["## Specifications", "## Orbit Quiet"]) {
        const clipped = priced + " ".repeat(16384 - priced.length - label.length) + label + " payment terms";
        expect((await research(adversePayload(path, [clipped], { price: amount }))).products[0].price, label).toBeNull();
      }
      expect((await research(adversePayload(path, [priced + "## Orbit Quiet\nWith trade-in."], { price: amount }))).products[0].price?.quote).toBe(amount);
    });
  }
  it("does not treat a clipped full-class heading as the complete source designation", async () => {
    const name = "Aster Wave 2 Headphones";
    const heading = `# ${name}`;
    const atLimit = " ".repeat(16384 - heading.length) + heading;
    const changes = { name, title: `${name} | Synthetic fixture` };
    expect((await research(adversePayload("heading", [atLimit + " Pro"], changes))).products).toEqual([]);
    expect((await research(adversePayload("heading", [atLimit], changes))).products.map((entry) => entry.name)).toEqual([name]);
  });
});

describe("complete source records without capitalization or clipped-newline inference", () => {
  for (const path of paths) {
    const openClass = path === "heading" ? adverseHeading : adverseClass.slice(0, -1);
    const payload = (text: string, closed = false) => adversePayload(path, [text], { facts: path === "heading" ? [] : [closed ? adverseClass : openClass] });
    for (const [label, separator] of [["LF", "\n"], ["CRLF", "\r\n"], ["space-LF", " \n"], ["LF-tab", "\n\t"]] as const) {
      const retained = " ".repeat(16384 - openClass.length - separator.length) + openClass + separator;
      it(`${path} rejects an open category before clipped ${label}`, async () => {
        expect((await research(payload(retained + "cases."))).products).toEqual([]);
      });
      it(`${path} accepts genuine EOF after category and ${label}`, async () => {
        expect((await research(payload(retained))).products).toHaveLength(1);
      });
    }
    it(`${path} accepts a closed category before a clipped newline`, async () => {
      const closed = path === "heading" ? `${adverseHeading}.` : adverseClass;
      const retained = " ".repeat(16384 - closed.length - 1) + closed + "\n";
      expect((await research(payload(retained + "More source content.", true))).products).toHaveLength(1);
    });
    for (const [label, separator, qualifier] of [
      ["inline-lower", " ", "for replacement pads."], ["inline-upper", " ", "For replacement pads."],
      ["wrapped-lower", "\n", "for replacement pads."], ["wrapped-upper", "\n", "For replacement pads."],
    ]) it(`${path} rejects the qualified category ${label}`, async () => {
      expect((await research(payload(openClass + separator + qualifier))).products).toEqual([]);
    });
  }
  it.each([["charging support.", 1], ["Charging support.", 1], ["Driver size: 42 mm.", 0], ["## Accessories\nCarrying case.", 0]] as const)("distinguishes property continuation from a new record: %s", async (next, expected) => {
    const result = await research(adversePayload("heading", [`${adverseHeading}\nWireless: No\n${next}`]), "wireless");
    expect(result.products).toHaveLength(expected);
    if (expected) {
      expect(result.products[0].facts).toEqual([]);
      expect(result.products[0].unresolvedConstraints).toContain("wireless needs independent verification");
    }
  });
  it.each(["Per month for 12 months.", "per month for 12 months."])("withholds a price before a wrapped condition: %s", async (condition) => {
    const result = await research(adversePayload("heading", [`${adverseHeading}\nPrice: SGD 349\n${condition}`], { price: "Price: SGD 349" }));
    expect(result.products).toHaveLength(1);
    expect(result.products[0].price).toBeNull();
  });
  it.each(["Driver size: 42 mm.", "## Specifications\nDriver size: 42 mm."])("accepts an established next record: %s", async (next) => {
    expect((await research(adversePayload("heading", [`${adverseHeading}\n${next}`]))).products).toHaveLength(1);
  });
});

describe("explicit gaps never complete an unfinished proposition", () => {
  const scoped = `${adverseHeading}\n## Specifications`;
  for (const [label, separator] of [["inline", " "], ["newline", "\n"]] as const) {
    it(`rejects an unfinished category before an ${label} gap`, async () => {
      expect((await research(adversePayload("heading", [adverseHeading + separator + "... cases."]))).products).toEqual([]);
    });
    it(`keeps an unfinished absence label unknown before an ${label} gap`, async () => {
      const result = await research(adversePayload("heading", [`${scoped}\nWireless: No${separator}... charging support.`]), "wireless");
      expect(result.products).toHaveLength(1);
      expect(result.products[0]).toMatchObject({ facts: [], price: null });
      expect(result.products[0].unresolvedConstraints).toContain("wireless needs independent verification");
    });
    it(`omits an unfinished specification before an ${label} gap`, async () => {
      const result = await research(adversePayload("heading", [`${scoped}\nDriver size: 42 mm${separator}... for Orbit Quiet.`], { facts: ["Driver size: 42 mm"] }));
      expect(result.products).toHaveLength(1);
      expect(result.products[0].facts).toEqual([]);
    });
    it(`withholds an unfinished amount before an ${label} gap`, async () => {
      const result = await research(adversePayload("heading", [`${scoped}\nPrice: SGD 349${separator}... per month for 12 months.`], { price: "Price: SGD 349" }));
      expect(result.products).toHaveLength(1);
      expect(result.products[0].price).toBeNull();
    });
  }
  it("retains an identity established by an actual section before a gap", async () => {
    const result = await research(adversePayload("heading", [`${scoped}\n... cases.`]));
    expect(result.products).toHaveLength(1);
    expect(result.products[0]).toMatchObject({ facts: [], price: null });
  });
  it.each(["Wireless: No.\n... charging support.", "Wireless: No\n## Specifications\nDriver size: 42 mm."])("excludes a completed absence label: %s", async (text) => {
    expect((await research(adversePayload("heading", [`${scoped}\n${text}`]), "wireless")).products).toEqual([]);
  });
  it("retains a completed specification before a gap", async () => {
    const result = await research(adversePayload("heading", [`${scoped}\nDriver size: 42 mm.\n... for Orbit Quiet.`], { facts: ["Driver size: 42 mm."] }));
    expect(result.products).toHaveLength(1);
    expect(result.products[0].facts.map((fact) => fact.quote)).toEqual(["Driver size: 42 mm."]);
  });
  it.each(["", "\n## Specifications\n... per month for 12 months."])("retains an amount completed by true EOF or a section: %s", async (suffix) => {
    const result = await research(adversePayload("heading", [`${scoped}\nPrice: SGD 349${suffix}`], { price: "Price: SGD 349" }));
    expect(result.products).toHaveLength(1);
    expect(result.products[0].price?.quote).toBe("Price: SGD 349");
  });
  it("preserves the complete sale, list and savings record before a gap", async () => {
    const block = "S$ 349 was S$ 499 SGD You Save S$ 150";
    const result = await research(adversePayload("heading", [`${scoped}\n${block}\n... Other context.`], { price: block }));
    expect(result.products).toHaveLength(1);
    expect(result.products[0].price?.quote).toBe(block);
  });
  it("preserves a closed direct price before a gap", async () => {
    const price = "Aster Wave 2 costs SGD 349.";
    const result = await research(adversePayload("direct", [`${adverseClass}\n${price}\n... per month for 12 months.`], { price }));
    expect(result.products).toHaveLength(1);
    expect(result.products[0].price?.quote).toBe(price);
  });
  it("retains an unpunctuated category at genuine EOF", async () => {
    expect((await research(adversePayload("heading", [adverseHeading]))).products).toHaveLength(1);
  });
  it("assesses an unpunctuated absence label at genuine EOF", async () => {
    expect((await research(adversePayload("heading", [`${scoped}\nWireless: No`]), "wireless")).products).toEqual([]);
  });
  it("retains an unpunctuated specification at genuine EOF", async () => {
    const result = await research(adversePayload("heading", [`${scoped}\nDriver size: 42 mm`], { facts: ["Driver size: 42 mm"] }));
    expect(result.products).toHaveLength(1);
    expect(result.products[0].facts.map((fact) => fact.quote)).toEqual(["Driver size: 42 mm"]);
  });
});
