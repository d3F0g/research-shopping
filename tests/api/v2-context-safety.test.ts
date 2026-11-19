import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShoppingIntent, TurnResponse } from "../../src/domain/conversation";
import { createApp } from "../../src/server/app";
import { createConversationService } from "../../src/server/conversations";
import { createExaProductResearch } from "../../src/server/exa-research";
import { nativeMaterial } from "../helpers/v2-material";

const servers: Server[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

function material(intent: ShoppingIntent, kind: "conflict" | "conditional" | "ordinary") {
  const source = kind === "conflict"
    ? "Fixture data: Model A is waterproof. Model A costs USD 89 for one unit, tax included."
    : `Fixture data. Model A costs GBP 89 for one unit, tax included.${kind === "conditional" ? " This price requires membership and a subscription. The ordinary Model A price is GBP 119." : ""}`;
  const original = nativeMaterial(intent);
  const result = JSON.parse(JSON.stringify(original).replaceAll(original.citations[0]!.text, source)) as ReturnType<typeof nativeMaterial>;
  const product = result.answer.products[0]!;
  product.name = "Fixture product Model A";
  product.price.amount = 89;
  product.price.currency = kind === "conflict" ? "USD" : "GBP";
  if (kind === "conditional") {
    product.price.conditions = ["membership and subscription required", "ordinary price GBP 119"];
    product.price.conditionsResolved = false;
  }
  if (kind === "conflict") {
    const adverse = { url: "https://manufacturer.com/model-a-limits", title: "Fixture data limits", text: "Fixture data: Model A is only splash-resistant. Heavy-rain protection has not been established.", image: "https://manufacturer.com/model-a.png" };
    result.citations.push(adverse);
    product.attributes = [{ name: "Water protection", assessment: { status: "conflict", scope: "exact-variant", rationale: "Fixture data: the retained sources disagree about water protection; heavy-rain protection remains unresolved.", support: [{ url: result.citations[0]!.url, quote: source }, { url: adverse.url, quote: adverse.text }] } }];
  }
  return result;
}

async function shopper(kind: "conflict" | "conditional" | "ordinary") {
  const requests: ShoppingIntent[] = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    const payload = JSON.parse(body);
    const intent = JSON.parse(payload.systemPrompt.split("Current authoritative shopping intent: ")[1]) as ShoppingIntent;
    requests.push(intent);
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(material(intent, kind)));
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No loopback address");
  const quota = { reserve: vi.fn(async () => "admitted" as const), settle: vi.fn(async () => {}) };
  const app = createApp({ conversations: createConversationService({ research: createExaProductResearch("fake-context-safety-key", { baseUrl: `http://127.0.0.1:${address.port}` }), quota }) });
  const session = await app.request("http://localhost:3000/api/session");
  const cookie = session.headers.get("set-cookie")!.split(";")[0]!;
  async function post(body: unknown) {
    const response = await app.request("http://localhost:3000/api/turn", { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(body) });
    expect(response.status).toBe(200);
    return await response.json() as TurnResponse;
  }
  async function submit(message: string) {
    const prepared = await post({ phase: "prepare", operationId: randomUUID(), message });
    return prepared.kind === "prepared" ? post({ phase: "research", preparedId: prepared.preparedId }) : prepared;
  }
  return { requests, quota, submit };
}

describe("context meaning through Hono and the actual Exa SDK", () => {
  it.each(["Make it89.", "Budget GBP89.", "Under GBP89."])("still dispatches an explicit budget edit: %s", async (message) => {
    const client = await shopper("ordinary");
    await client.submit("Find an archival book cradle between GBP50 and100.");
    const result = await client.submit(message);
    expect(result.kind).toBe("research");
    expect(result.state.intent.budget).toEqual({ minimum: 50, maximum: 89, currency: "GBP" });
    expect(client.requests).toHaveLength(2);
    expect(client.quota.reserve).toHaveBeenCalledTimes(2);
    expect(client.requests[1]!.budget).toEqual(result.state.intent.budget);
  });

  it.each(["Find an unfamiliar hand tool under GBP95.", "Can you research new sources for an unfamiliar hand tool?", "Research again."])("still dispatches explicitly requested research: %s", async (message) => {
    const client = await shopper("ordinary");
    await client.submit("Find an archival book cradle between GBP50 and100. No plastic supports.");
    const result = await client.submit(message);
    expect(result.kind).toBe("research");
    expect(result.state.intent.budget?.minimum).toBe(50);
    expect(result.state.intent.productDescription).toContain("No plastic supports");
    expect(client.requests).toHaveLength(2);
    expect(client.quota.reserve).toHaveBeenCalledTimes(2);
  });

  it("does not infer new evidence from a user source claim or relabel its money as a budget", async () => {
    const client = await shopper("ordinary");
    const researched = await client.submit("Find an archival book cradle between GBP50 and100.");
    const result = await client.submit("One source says it is waterproof and costs USD12. Which source is right?");
    expect(result.kind).toBe("message");
    expect(result.state.intent).toEqual(researched.state.intent);
    expect(result.state.messages.at(-1)?.text).toContain("unknown");
    expect(result.state.messages.at(-1)?.detail).not.toContain("waterproof");
    expect(result.state.messages.at(-1)?.detail).not.toContain("USD12");
    expect(client.requests).toHaveLength(1);
    expect(client.quota.reserve).toHaveBeenCalledTimes(1);
  });

  it("keeps an ordinary eligible held price usable without changing the accepted cap", async () => {
    const client = await shopper("ordinary");
    const researched = await client.submit("Find an archival book cradle between GBP50 and100.");
    expect(researched.kind).toBe("research");
    if (researched.kind !== "research") throw new Error("No research");
    expect(researched.research.products[0]!.blockers).toEqual([]);
    expect(researched.research.choice).not.toBeNull();
    const result = await client.submit("That GBP89 one looks good.");
    expect(result.kind).toBe("message");
    expect(result.state.intent).toEqual(researched.state.intent);
    expect(result.state.messages.at(-1)?.text).toContain("Observed GBP 89");
    const best = await client.submit("Just give me the best one.");
    expect(best.state.messages.at(-1)?.text).toContain("retained source-supported option");
    expect(client.requests).toHaveLength(1);
    expect(client.quota.reserve).toHaveBeenCalledTimes(1);
  });

  it("does not dispatch or partially accept a held selection combined with an unknown edit", async () => {
    const client = await shopper("ordinary");
    const researched = await client.submit("Find an archival book cradle between GBP50 and100.");
    const message = "That GBP89 one looks good. I'm not a member and remove the minimum.";
    const result = await client.submit(message);
    expect(result.kind).toBe("clarification");
    expect(result.state.intent).toEqual(researched.state.intent);
    expect(result.state.pending).toMatchObject({ kind: "edit", message });
    expect(client.requests).toHaveLength(1);
    expect(client.quota.reserve).toHaveBeenCalledTimes(1);
  });

  it("answers source disagreement from retained passages without another reservation or request", async () => {
    const client = await shopper("conflict");
    const researched = await client.submit("Find a waterproof backpack under USD100. It must protect contents in heavy rain.");
    expect(researched.kind).toBe("research");
    const followup = await client.submit("One source says waterproof and another says only splash-resistant. Which is it?");
    expect(followup.kind).toBe("message");
    expect(followup.state.intent).toEqual(researched.state.intent);
    expect(followup.state.messages.slice(0, researched.state.messages.length)).toEqual(researched.state.messages);
    const answer = followup.state.messages.at(-1)!;
    expect(answer.text).toContain("conflict");
    expect(answer.detail).toContain("Model A is waterproof");
    expect(answer.detail).toContain("only splash-resistant");
    expect(answer.detail).toContain("https://manufacturer.com/model-a-limits");
    expect(client.requests).toHaveLength(1);
    expect(client.quota.reserve).toHaveBeenCalledTimes(1);
    expect(client.quota.settle).toHaveBeenCalledTimes(1);
  });

  it("retains both bounds and buyer restrictions without applying a conditional quoted price", async () => {
    const client = await shopper("conditional");
    const researched = await client.submit("Find a compact photo printer between GBP50 and100. No disposable batteries.");
    expect(researched.kind).toBe("research");
    if (researched.kind !== "research") throw new Error("No research");
    expect(researched.research.products[0]!.price).toMatchObject({ amount: 89, currency: "GBP", conditionsResolved: false });
    expect(researched.research.choice).toBeNull();
    const followup = await client.submit("That GBP89 one looks good. I'm not a member and won't subscribe.");
    expect(followup.kind).toBe("message");
    expect(followup.state.intent.budget).toEqual({ minimum: 50, maximum: 100, currency: "GBP" });
    expect(followup.state.intent.requirements.slice(0, researched.state.intent.requirements.length)).toEqual(researched.state.intent.requirements);
    expect(followup.state.intent.requirements.at(-1)).toMatchObject({ text: "I'm not a member and won't subscribe.", strength: "hard" });
    expect(followup.state.messages.at(-1)?.text).toMatch(/unresolved|cannot confirm/i);
    expect(followup.state.messages.at(-1)?.detail).toContain("GBP 119");
    expect(followup.state.messages.at(-1)?.detail).toContain("membership");
    expect(followup.state.messages.slice(0, researched.state.messages.length)).toEqual(researched.state.messages);
    expect(client.requests).toHaveLength(1);
    expect(client.quota.reserve).toHaveBeenCalledTimes(1);
    const best = await client.submit("Just give me the best one.");
    expect(best.state.messages.at(-1)?.text).toContain("cannot choose a compliant best");
    expect(client.requests).toHaveLength(1);
  });
});
