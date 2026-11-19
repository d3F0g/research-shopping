import { createServer } from "node:http";
import { serve } from "@hono/node-server";
import { createApp } from "../../src/server/app";
import { configFromEnvironment } from "../../src/server/config";
import { createConversationService } from "../../src/server/conversations";
import { createExaProductResearch } from "../../src/server/exa-research";
import { nativeMaterial } from "./v2-material";
import type { ShoppingIntent } from "../../src/domain/conversation";

if (
  process.env.NODE_ENV !== "test" ||
  process.env.EXA_RESEARCH_ENABLED !== "false"
)
  throw new Error("Automated fixture composition only");
let calls = 0;
const upstream = createServer(async (request, response) => {
  let body = "";
  for await (const chunk of request) body += chunk;
  if (request.url !== "/answer") {
    response.writeHead(404).end();
    return;
  }
  calls++;
  const input = JSON.parse(body) as { systemPrompt: string };
  const intent = JSON.parse(
    input.systemPrompt.split("Current authoritative shopping intent: ")[1]!,
  ) as ShoppingIntent;
  const material = nativeMaterial(intent);
  if (intent.productDescription.includes("slow fixture"))
    await new Promise((resolve) => setTimeout(resolve, 600));
  if (intent.productDescription.includes("provider error")) {
    response.writeHead(503).end("unavailable");
    return;
  }
  material.answer.products = ["A", "B", "C"].map((suffix, i) => {
    const p = structuredClone(material.answer.products[0]!);
    p.id = `model-${suffix.toLowerCase()}`;
    p.name = `Fixture Powerbank Model ${suffix}`;
    p.variant = `Model ${suffix}`;
    p.price.variant = p.variant;
    p.price.amount = 35 + i;
    const text = material.citations[0]!.text.replaceAll(
      "Model A",
      p.variant,
    ).replaceAll("SGD 35", `SGD ${35 + i}`);
    const url = `https://manufacturer.com/model-${suffix.toLowerCase()}`;
    material.citations[i] = {
      url,
      title: `Fixture data ${p.variant}`,
      text,
      image: `${url}.png`,
    };
    for (const assessment of [
      p.identity,
      p.requestMatch,
      ...p.criteria.map((c) => c.assessment),
      ...p.attributes.map((a) => a.assessment),
      p.price.assessment,
    ])
      assessment.support = [{ url, quote: text }];
    return p;
  });
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(material));
});
await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
const address = upstream.address();
if (!address || typeof address === "string")
  throw new Error("No test upstream");
const sdk = createExaProductResearch("fixture-only-key", {
  baseUrl: `http://127.0.0.1:${address.port}`,
  timeoutMs: 1000,
});
const seen = new Set<string>();
const conversations = createConversationService({
  research: async (request, signal) => {
    const result = await sdk(request, signal);
    if (result.status === "ready") result.research.dataKind = "test-fixture";
    return result;
  },
  quota: {
    reserve: async (id) => {
      if (seen.has(id)) return "duplicate";
      seen.add(id);
      return "admitted";
    },
    settle: async () => {},
  },
});
const config = configFromEnvironment(process.env);
const app = createApp({ conversations }, config);
app.get("/api/test-stats", (c) => c.json({ calls }));
serve({ fetch: app.fetch, hostname: "127.0.0.1", port: config.apiPort });
