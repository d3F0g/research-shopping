import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { initialConversation, type ShoppingIntent } from "../../src/domain/conversation";
import { reduceTurn } from "../../src/domain/turn-reducer";
import { createExaProductResearch, projectExaAnswer } from "../../src/server/exa-research";
import { nativeMaterial } from "../helpers/v2-material";

const servers: Server[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
function sunglassesIntent() {
  return reduceTurn(initialConversation(), {
    phase: "prepare",
    operationId: randomUUID(),
    message: "Find sunglasses between SGD 800 and 1000",
  }).state.intent;
}
function merchantMaterial(intent: ShoppingIntent, priceBlock: string) {
  const material = nativeMaterial(intent);
  const product = material.answer.products[0]!;
  product.name = "Fixture Meridian Sunglasses AX1";
  product.variant = "AX1";
  product.price!.amount = 850;
  product.price!.variant = "AX1";
  const text = `Fixture data: Fixture Meridian Sunglasses AX1 are sunglasses.\n\n${priceBlock}`;
  const support = [{ url: material.citations[0]!.url, quote: text }];
  const assessment = {
    status: "supported",
    scope: "exact-variant",
    rationale: "Fixture data: the exact AX1 passage supports this assessment.",
    support,
  };
  product.identity = assessment;
  product.requestMatch = assessment;
  product.criteria = intent.requirements.map((r) => ({ criterionId: r.id, assessment }));
  product.attributes = [];
  product.price!.assessment = assessment;
  material.citations[0]!.text = text;
  return material;
}

describe("shopping retrieval and ordinary source price blocks", () => {
  it("sends accepted edited budget and hard requirements in the SDK retrieval query", async () => {
    const before = reduceTurn(initialConversation(), {
      phase: "prepare",
      operationId: randomUUID(),
      message: "Find sunglasses under USD100",
    }).state;
    const current = reduceTurn(before, {
      phase: "prepare",
      operationId: randomUUID(),
      expectedRevision: before.revision,
      message: "Updated shopping preferences",
      edit: {
        description: "sunglasses",
        budget: { minimum: 800, maximum: 1000, currency: "SGD" },
        requirements: [{ id: "polarized", text: "Polarized lenses", strength: "hard" }],
      },
    }).state.intent;
    expect(current.budget).toEqual({ minimum: 800, maximum: 1000, currency: "SGD" });
    let query = "";
    let calls = 0;
    const server = createServer(async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      calls++;
      query = JSON.parse(body).query;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(nativeMaterial(current)));
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No socket");
    await createExaProductResearch("fixture-local-key", {
      baseUrl: `http://127.0.0.1:${address.port}`,
    })({ intent: current }, new AbortController().signal);
    expect(calls).toBe(1);
    expect(query).toContain("sunglasses");
    expect(query).toContain("800");
    expect(query).toContain("1000");
    expect(query).toContain("SGD");
    expect(query).toContain("Polarized lenses");
  });
  it("binds equivalent safe URL spellings through the actual SDK response", async () => {
    const current = reduceTurn(initialConversation(), {
      phase: "prepare", operationId: randomUUID(), message: "a USB-C powerbank between SGD30 and40",
    }).state.intent;
    const material = JSON.parse(JSON.stringify(nativeMaterial(current)).replaceAll(
      "https://manufacturer.com/model-a", "https://manufacturer.com",
    ));
    const server = createServer((_req, res) => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(material));
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No socket");
    const result = await createExaProductResearch("fixture-local-key", {
      baseUrl: `http://127.0.0.1:${address.port}`,
    })({ intent: current }, new AbortController().signal);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("No comparison");
    expect(result.research.sources[0]!.url).toBe("https://manufacturer.com/");
    expect(result.research.products[0]!.identity.status).toBe("supported");
    expect(result.research.choice?.productId).toBe("model-a");
  });
  it("retains a single exact product-heading price block as an observed price", () => {
    const intent = sunglassesIntent();
    const result = projectExaAnswer(merchantMaterial(intent,
      "Fixture Meridian Sunglasses AX1\nSGD 850.00\nFor one unit, tax included.",
    ), intent);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("No comparison");
    expect(result.research.products[0]!.price).toMatchObject({
      amount: 850, currency: "SGD", variant: "AX1", conditionsResolved: true,
    });
    expect(result.research.products[0]!.eligible).toBe(true);
    expect(result.research.choice?.productId).toBe("model-a");
  });
  it.each([
    "Fixture Meridian Sunglasses AX1\nSGD 850.00\nOnly available with membership.",
    "Fixture Meridian Sunglasses AX2\nSGD 850.00\nFor one unit, tax included.",
    "Fixture Meridian Sunglasses AX1\nSGD 850.00–1200.00\nDepending on configuration.",
    "Fixture Meridian Sunglasses AX1\n$850.00\nFor one unit, tax included.",
    "Fixture Meridian Sunglasses AX1\nSGD 850.00\nShipping SGD 100 is mandatory.",
  ])("does not recommend unresolved price block %s", (block) => {
    const intent = sunglassesIntent();
    const result = projectExaAnswer(merchantMaterial(intent, block), intent);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("No comparison");
    expect(result.research.choice).toBeNull();
    expect(result.research.products[0]!.eligible).toBe(false);
  });
});
