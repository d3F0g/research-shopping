import { serve } from "@hono/node-server";
import { appendFile } from "node:fs/promises";
import {
  configuredAccounts,
  accountConfiguration,
} from "../../src/server/accounts";
import { createApp } from "../../src/server/app";
import { configFromEnvironment } from "../../src/server/config";
import { createResearchTurns } from "../../src/server/research-turns";
import { conversationPolicy } from "../../src/domain/conversation-policy";
import type { ResearchTurns } from "../../src/domain/research";

if (
  process.env.NODE_ENV !== "test" ||
  process.env.EXA_RESEARCH_ENABLED !== "false" ||
  !process.env.FIELDNOTE_CRASH_PROVIDER_LOG
)
  throw new Error(
    "Only the explicit offline crash fixture runner may launch this server",
  );
const stage = process.env.FIELDNOTE_CRASH_STAGE;
async function pause(event: string) {
  if (stage !== event) return;
  process.send?.({ event });
  await new Promise<void>((resolve) =>
    process.once("message", () => resolve()),
  );
}
const turns: ResearchTurns = {
  async turn(request) {
    await pause("accepted");
    await appendFile(
      process.env.FIELDNOTE_CRASH_PROVIDER_LOG!,
      `${request.operationId}\n`,
    );
    await pause("dispatched");
    const preferences = conversationPolicy(
      request.message,
      request.preferences,
    ).preferences;
    await pause("provider-returned");
    return {
      kind: "research-unavailable",
      reason: "disabled",
      message: "Automated crash-test fixture response. No live research ran.",
      preferences,
      notes: [],
    };
  },
};
const config = configFromEnvironment(process.env);
const accounts = await configuredAccounts(
  accountConfiguration(process.env),
  turns,
);
const app = createApp(
  {
    accounts: accounts.accounts,
    accountCapability: accounts.capability,
    researchTurns: createResearchTurns({ unavailableReason: "disabled" }),
  },
  config,
);
const server = serve({
  hostname: "127.0.0.1",
  port: config.apiPort,
  fetch: async (request, env) => {
    const response = await app.fetch(request, env);
    if (
      request.method === "POST" &&
      new URL(request.url).pathname === "/api/workspace" &&
      response.ok
    )
      await pause("committed");
    return response;
  },
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    server.close();
    void accounts.close().then(() => process.exit(0));
  });
