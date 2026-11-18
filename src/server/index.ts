import { accountConfiguration, configuredAccounts } from "./accounts";
import { serve } from "@hono/node-server";
import { isAbsolute } from "node:path";
import { createApp } from "./app";
import { configFromEnvironment } from "./config";
import { createExaProductResearch } from "./exa-research";
import { createResearchQuota } from "./research-quota";
import { createResearchTurns } from "./research-turns";

const config = configFromEnvironment(process.env);
const fixtureMode = process.env.NODE_ENV === "test" && process.env.FIELDNOTE_TEST_FIXTURES === "true";
const enabled = process.env.NODE_ENV === "development" && process.env.EXA_RESEARCH_ENABLED !== "false";
const key = process.env.EXA_API_KEY?.trim();
const ledgerPath = process.env.EXA_RESEARCH_LEDGER_PATH;
const configured = enabled && Boolean(key) && Boolean(ledgerPath && isAbsolute(ledgerPath));
const researchTurns = createResearchTurns(configured && key && ledgerPath ? {
  research: createExaProductResearch(key), quota: createResearchQuota(ledgerPath),
} : { unavailableReason: enabled ? "not-configured" : "disabled" });
const composeApp = fixtureMode ? (await import("./test-fixture-app")).createFixtureApp : createApp;
const accounts = await configuredAccounts(accountConfiguration(process.env), researchTurns);
const app = composeApp({
  accounts: accounts.accounts,
  accountCapability: accounts.capability,
  mode: fixtureMode ? "test-fixture" : "research",
  researchAvailable: configured,
  ...(!fixtureMode ? { researchTurns } : {}),
  logger: (event) => process.stdout.write(`${JSON.stringify(event)}\n`),
}, config);
const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: config.apiPort });
process.stdout.write(`Fieldnote ${fixtureMode ? "test fixture" : "research"} API listening on http://127.0.0.1:${config.apiPort}\n`);

for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => { server.close(); void accounts.close().then(() => process.exit(0)); });
