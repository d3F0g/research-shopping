import { createServer, type Server } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { randomUUID } from "node:crypto";
import { chmod, mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExaDiagnosticWriter } from "../../src/server/exa-diagnostics";
import { createApp } from "../../src/server/app";
import { createConversationService } from "../../src/server/conversations";
import { afterEach, describe, expect, it } from "vitest";
import { initialConversation, type ShoppingIntent } from "../../src/domain/conversation";
import { reduceTurn } from "../../src/domain/turn-reducer";
import { createExaProductResearch, projectExaAnswer } from "../../src/server/exa-research";
import { nativeMaterial } from "../helpers/v2-material";

const servers: Server[] = [];
const directories: string[] = [];
afterEach(async () => {
  for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true });
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
  it.each(["https://user:password@manufacturer.com/", "https://manufacturer.com/?variant=other", "https://manufacturer.com/#other", "javascript:alert(1)"])(
    "does not bind unsafe or distinct support URL %s", (url) => {
      const current = reduceTurn(initialConversation(), {
        phase: "prepare", operationId: randomUUID(), message: "a USB-C powerbank between SGD30 and40",
      }).state.intent;
      const material = nativeMaterial(current);
      material.answer.products[0]!.identity.support[0]!.url = url;
      const result = projectExaAnswer(material, current);
      if (result.status !== "ready") throw new Error("No comparison");
      expect(result.research.choice).toBeNull();
      expect(result.research.products[0]!.identity.status).toBe("unknown");
    },
  );
  it("does not erase conflicting text at equivalent canonical citation URLs", () => {
    const current = reduceTurn(initialConversation(), {
      phase: "prepare", operationId: randomUUID(), message: "a USB-C powerbank between SGD30 and40",
    }).state.intent;
    const material = nativeMaterial(current);
    material.citations[0]!.url = "https://manufacturer.com";
    material.answer.products[0]!.identity.support[0]!.url = "https://manufacturer.com/";
    material.citations.push({ ...material.citations[0]!, url: "https://manufacturer.com/", text: "Fixture data: Model A costs SGD65, not SGD35." });
    expect(projectExaAnswer(material, current).status).toBe("unavailable");
  });
  it.each([
    "Fixture Meridian Sunglasses AX1\nSGD 850.00\nFor one unit, tax included.",
    "Fixture Meridian Sunglasses AX1\nPrice: SGD 850.00\nTax included.",
    "AX1\nSGD 850.00\nTax included.",
    "Fixture Meridian Sunglasses AX1\nPrice: SGD 850.00, tax included.",
  ])("retains a single exact product-heading price block %s", (block) => {
    const intent = sunglassesIntent();
    const result = projectExaAnswer(merchantMaterial(intent, block), intent);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("No comparison");
    expect(result.research.products[0]!.price).toMatchObject({
      amount: 850, currency: "SGD", variant: "AX1", conditionsResolved: true,
    });
    expect(result.research.products[0]!.eligible).toBe(true);
    expect(result.research.choice?.productId).toBe("model-a");
  });
  it("keeps two uniquely scoped price cards usable without mixing their prices", () => {
    const intent = sunglassesIntent();
    const material = merchantMaterial(intent, "Fixture Meridian Sunglasses AX1\nPrice: SGD850\nTax included.\n\nFixture Meridian Sunglasses BX2\nPrice: SGD950\nTax included.");
    const other = structuredClone(material.answer.products[0]!);
    other.id = "model-b";
    other.name = "Fixture Meridian Sunglasses BX2";
    other.variant = "BX2";
    other.price!.amount = 950;
    other.price!.variant = "BX2";
    material.answer.products.push(other);
    const result = projectExaAnswer(material, intent);
    if (result.status !== "ready") throw new Error("No comparison");
    expect(result.research.products.map((product) => [product.id, product.price?.amount, product.eligible])).toEqual([
      ["model-a", 850, true], ["model-b", 950, true],
    ]);
  });
  it.each([
    "Fixture Meridian Sunglasses AX1\nPrice: SGD850 to SGD1200\nDepending on configuration.",
    "Fixture Meridian Sunglasses AX1\nPrice: SGD850–1200\nDepending on configuration.",
    "Fixture Meridian Sunglasses AX1\nSGD850\nFor AX2 only.",
    "Fixture Meridian Sunglasses AX1\nSGD850\nFor AX2.",
    "Fixture Meridian Sunglasses AX1\nSGD850\nPrice applies to AX2 only.",
    "Fixture Meridian Sunglasses AX1\nSGD850\nAX2 variant only.",
    "Fixture Meridian Sunglasses AX1\nSGD850\nFor three units.",
    "AX1 costs SGD850 to SGD1200 depending on configuration.",
    "AX1 costs SGD850 for AX2 only.",
    "AX1 costs SGD850 for three units.",
    "AX1 costs SGD850, tax included. For AX2.",
  ])("withholds a single exact price when its amount, variant or quantity is unbound: %s", (block) => {
    const intent = sunglassesIntent();
    const result = projectExaAnswer(merchantMaterial(intent, block), intent);
    if (result.status !== "ready") throw new Error("No comparison");
    expect(result.research.choice).toBeNull();
    expect(result.research.products[0]!.price).toBeNull();
  });
  it("does not display another native price variant under the selected product", () => {
    const intent = sunglassesIntent();
    const material = merchantMaterial(intent, "AX2\nSGD850\nTax included.");
    material.answer.products[0]!.price!.variant = "AX2";
    const result = projectExaAnswer(material, intent);
    if (result.status !== "ready") throw new Error("No comparison");
    expect(result.research.products[0]!.price).toBeNull();
    expect(result.research.choice).toBeNull();
  });
  it("retains a literal known membership price condition prominently without making a choice", () => {
    const intent = sunglassesIntent();
    const result = projectExaAnswer(merchantMaterial(intent, "Fixture Meridian Sunglasses AX1\nSGD850\nTax included.\nMembership required."), intent);
    if (result.status !== "ready") throw new Error("No comparison");
    expect(result.research.products[0]!.price).toMatchObject({ amount: 850, variant: "AX1", conditionsResolved: false, conditions: ["Membership required"] });
    expect(result.research.choice).toBeNull();
  });
  it.each([
    "Fixture Meridian Sunglasses AX1\nSGD 850.00\nOnly available with membership.",
    "Fixture Meridian Sunglasses AX2\nSGD 850.00\nFor one unit, tax included.",
    "Fixture Meridian Sunglasses AX1\nSGD 850.00–1200.00\nDepending on configuration.",
    "Fixture Meridian Sunglasses AX1\n$850.00\nFor one unit, tax included.",
    "Fixture Meridian Sunglasses AX1\nSGD 850.00\nShipping SGD 100 is mandatory.",
    "Fixture Meridian Sunglasses AX1\nSGD 850.00\nNot tax included.",
    "Fixture Meridian Sunglasses AX1\nSGD 850.00\nTax included, unless a voucher is unavailable.",
    "Fixture Meridian Sunglasses AX1\nSGD 850.00\nFor AX2 only.",
    "Fixture Meridian Sunglasses AX1\nSGD 850.00\nTax included.\n\nShipping costs SGD100.",
    "Fixture Meridian Sunglasses AX1\nSGD 850.00\nTax included.\nMinimum purchase of three units.",
    "Fixture Meridian Sunglasses AX1\nSGD 950.00\nTax included.",
  ])("does not recommend unresolved price block %s", (block) => {
    const intent = sunglassesIntent();
    const result = projectExaAnswer(merchantMaterial(intent, block), intent);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("No comparison");
    expect(result.research.choice).toBeNull();
    expect(result.research.products[0]!.eligible).toBe(false);
  });
});

describe("private projection diagnostics at the SDK boundary", () => {
  async function endpoint(material: unknown) {
    let calls = 0;
    const server = createServer(async (req, res) => {
      calls++;
      let body = "";
      for await (const chunk of req) body += chunk;
      const response = typeof material === "function" ? material(JSON.parse(body)) : material;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(response));
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No socket");
    return { baseUrl: `http://127.0.0.1:${address.port}`, calls: () => calls };
  }
  it.each(["complete", "membership"])("exercises %s source card through real API and SDK sockets", async (mode) => {
    const block = `Fixture Meridian Sunglasses AX1\nPrice: SGD850\nTax included.${mode === "membership" ? "\nMembership required." : ""}`;
    const sdk = await endpoint((request: { systemPrompt: string }) => merchantMaterial(
      JSON.parse(request.systemPrompt.split("Current authoritative shopping intent: ")[1]!), block,
    ));
    let reservations = 0;
    const server = createServer();
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No API socket");
    const app = createApp({ conversations: createConversationService({
      research: createExaProductResearch("fixture-local-key", { baseUrl: sdk.baseUrl }),
      quota: { reserve: async () => { reservations++; return "admitted"; }, settle: async () => undefined },
    }) }, { apiPort: address.port, webPort: address.port });
    server.on("request", getRequestListener(app.fetch));
    const origin = `http://127.0.0.1:${address.port}`;
    const prepared = await fetch(`${origin}/api/turn`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ phase: "prepare", operationId: randomUUID(), message: "Find sunglasses between SGD800 and1000" }) });
    const data = await prepared.json();
    expect(data.kind).toBe("prepared");
    const result = await fetch(`${origin}/api/turn`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", Cookie: prepared.headers.get("set-cookie")!.split(";")[0]! }, body: JSON.stringify({ phase: "research", preparedId: data.preparedId }) });
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.kind).toBe("research");
    expect(body.research.intent.budget).toEqual({ minimum: 800, maximum: 1000, currency: "SGD" });
    expect(body.research.products[0].eligible).toBe(mode === "complete");
    expect(body.research.choice?.productId ?? null).toBe(mode === "complete" ? "model-a" : null);
    expect(reservations).toBe(1);
    expect(sdk.calls()).toBe(1);
  });
  it("captures exact schema failure privately while normal HTTP returns only honest unavailability", async () => {
    const path = await realpath(await mkdtemp(join(tmpdir(), "fieldnote-sdk-capture-test-")));
    directories.push(path);
    await chmod(path, 0o700);
    const material = nativeMaterial(sunglassesIntent());
    material.answer.products[0]!.identity.status = "unexpected-fixture-status";
    const sdk = await endpoint(material);
    let reservations = 0;
    const settlements: unknown[] = [];
    const app = createApp({ conversations: createConversationService({
      research: createExaProductResearch("fixture-private-key", { baseUrl: sdk.baseUrl, diagnostics: createExaDiagnosticWriter(path) }),
      quota: { reserve: async () => { reservations++; return "admitted"; }, settle: async (...args) => { settlements.push(args); } },
    }) });
    const headers = { "Content-Type": "application/json", Origin: "http://127.0.0.1:5173" };
    const prepared = await app.request("http://127.0.0.1:3000/api/turn", { method: "POST", headers, body: JSON.stringify({ phase: "prepare", operationId: randomUUID(), message: "Find sunglasses between SGD800 and1000" }) });
    expect(prepared.status).toBe(200);
    const data = await prepared.json();
    expect(data.kind).toBe("prepared");
    const response = await app.request("http://127.0.0.1:3000/api/turn", { method: "POST", headers: { ...headers, Cookie: prepared.headers.get("set-cookie")!.split(";")[0]! }, body: JSON.stringify({ phase: "research", preparedId: data.preparedId }) });
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("could not be validated");
    expect(text).not.toContain("unexpected-fixture-status");
    expect(text).not.toContain("projection");
    expect(text).not.toContain("fixture-private-key");
    expect(reservations).toBe(1);
    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual([expect.any(String), 0.005, true]);
    expect(sdk.calls()).toBe(1);
    const names = await readdir(path);
    expect(names).toHaveLength(1);
    const saved = JSON.parse(await readFile(join(path, names[0]!), "utf8"));
    expect(saved.projection.stage).toBe("answer-schema");
    expect(saved.projection.issues).toContainEqual({ path: ["products", "0", "identity", "status"], code: "invalid_value" });
    expect(saved.raw.response).toEqual(material);
    expect(saved.intent.budget).toEqual({ minimum: 800, maximum: 1000, currency: "SGD" });
  });
  it.each(["throws", "never-settles"])("does not let a diagnostic observer that %s change paid result or retry", async (behavior) => {
    const current = sunglassesIntent();
    const sdk = await endpoint(nativeMaterial(current));
    let captures = 0;
    const result = await createExaProductResearch("fixture-private-key", {
      baseUrl: sdk.baseUrl,
      diagnostics: async () => { captures++; if (behavior === "throws") throw new Error("Fixture capture failure"); return new Promise<void>(() => undefined); },
    })({ intent: current }, new AbortController().signal);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("No comparison");
    expect(result.research.reportedCostUsd).toBe(0.005);
    expect(captures).toBe(1);
    expect(sdk.calls()).toBe(1);
  });
});
