import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { initialConversation, type TurnResponse } from "../../src/domain/conversation";
import { projectExaAnswer } from "../../src/server/exa-research";
import { createApp } from "../../src/server/app";
import { createConversationService } from "../../src/server/conversations";
import { nativeMaterial } from "../helpers/v2-material";
import { priceMaterial } from "../helpers/v5-material";

const intent = { ...initialConversation().intent, productDescription: "a quartz wristwatch with a steel case", budget: { minimum: 400, maximum: 500, currency: "SGD" } };
const oldWirePositive = (style = "Markdown") => {
  const old = nativeMaterial(intent);
  const text = style === "Markdown" ? "Fixture data. Fixture Powerbank Model A is a USB-C powerbank.\n\n| Model | Price |\n| Model A | SGD 437 |\n\nOne unit. Tax included. No membership or voucher is required." : "Fixture data. Fixture Powerbank Model A is a USB-C powerbank.\n\nChoose Model A for your order. The tag reads 437 SGD for one unit, including tax.";
  const material = JSON.parse(JSON.stringify(old).replaceAll(JSON.stringify(old.citations[0]!.text).slice(1, -1), JSON.stringify(text).slice(1, -1))) as typeof old;
  material.citations[0]!.text = text;
  material.answer.products[0]!.price.amount = 437;
  return material;
};

describe("Issue 64 original wire parser reproduction", () => {
  it.each(["Markdown", "prose"])("keeps an ordinary complete %s price usable on the original wire", (style) => {
    const result = projectExaAnswer(oldWirePositive(style), intent);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("Expected source comparison");
    expect(result.research.products[0]!.eligible).toBe(true);
    expect(result.research.choice?.productId).toBe("model-a");
  });
  it("retains an ordinary complete price through the original real route", async () => {
    const app = createApp({ conversations: createConversationService({ research: async ({ intent: current }) => projectExaAnswer(oldWirePositive(), current), quota: { reserve: vi.fn(async () => "admitted" as const), settle: vi.fn(async () => {}) } }) });
    const first = await app.request("http://localhost:3000/api/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phase: "prepare", operationId: randomUUID(), message: "a USB-C powerbank between SGD400 and500" }) });
    const prepared = await first.json() as TurnResponse;
    if (prepared.kind !== "prepared") throw new Error("Expected prepared research");
    const result = await app.request("http://localhost:3000/api/turn", { method: "POST", headers: { "content-type": "application/json", cookie: first.headers.get("set-cookie")!.split(";")[0]! }, body: JSON.stringify({ phase: "research", preparedId: prepared.preparedId }) });
    const body = await result.json() as TurnResponse;
    expect(body.kind).toBe("research");
    if (body.kind !== "research") throw new Error("Expected source comparison");
    expect(body.research.choice?.productId).toBe("model-a");
  });
});

describe("V5 ordinary source prices and independent source alarms", () => {
  it("uses a complete Markdown amount for both bounds and a computed choice", () => {
    const result = projectExaAnswer(priceMaterial(intent), intent);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("Expected V5 source comparison");
    expect(result.research).toMatchObject({ evidenceVersion: 5, choice: { productId: "fixture-q17" }, products: [{ eligible: true, priceEvidence: { state: "applicable", usableMoney: { minorUnits: 43700, currency: "SGD" } } }] });
  });
  it("retains an amount but blocks optimistic omission of a club requirement through the real route", async () => {
    const app = createApp({ conversations: createConversationService({ research: async ({ intent: current }) => {
      const material = priceMaterial(current);
      material.citations[0]!.text += "\n\nThis amount is available only after joining the annual club.";
      return projectExaAnswer(material, current);
    }, quota: { reserve: vi.fn(async () => "admitted" as const), settle: vi.fn(async () => {}) } }) });
    const session = await app.request("http://localhost:3000/api/session");
    const cookie = session.headers.get("set-cookie")!.split(";")[0]!;
    const post = async (body: unknown) => {
      const response = await app.request("http://localhost:3000/api/turn", { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(body) });
      expect(response.status).toBe(200);
      return await response.json() as TurnResponse;
    };
    const prepared = await post({ phase: "prepare", operationId: randomUUID(), message: "a quartz wristwatch with a steel case between SGD400 and500" });
    expect(prepared.kind).toBe("prepared");
    if (prepared.kind !== "prepared") throw new Error("Expected prepared research");
    const result = await post({ phase: "research", preparedId: prepared.preparedId });
    expect(result.kind).toBe("research");
    if (result.kind !== "research") throw new Error("Expected research");
    expect(result.research).toMatchObject({ evidenceVersion: 5, choice: null, products: [{ eligible: false, priceEvidence: { state: "observed", alarms: [{ kind: "buyer-restriction" }] } }] });
    expect(result.research.sources[0]!.text).toContain("only after joining the annual club");
    expect(result.state.intent.budget).toEqual(intent.budget);
  });
});
