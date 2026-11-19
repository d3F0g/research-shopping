import { serve } from "@hono/node-server";
import { isAbsolute } from "node:path";
import { createApp } from "./app";
import { configFromEnvironment } from "./config";
import { createExaProductResearch } from "./exa-research";
import { createResearchQuota } from "./research-quota";
import { researchDiagnosticPath } from "./research-diagnostics";
import { createOpenAIIntentInterpreter } from "./openai-intent";
import { createResearchTurns } from "./research-turns";

const config = configFromEnvironment(process.env);
const fixtureMode = process.env.NODE_ENV === "test" && process.env.FIELDNOTE_TEST_FIXTURES === "true";
const enabled = process.env.NODE_ENV === "development" && process.env.EXA_RESEARCH_ENABLED !== "false";
const key = process.env.EXA_API_KEY?.trim();
const ledgerPath = process.env.EXA_RESEARCH_LEDGER_PATH;
const configured = enabled && Boolean(key) && Boolean(ledgerPath && isAbsolute(ledgerPath));
const intentEnabled = process.env.NODE_ENV === "development" && process.env.OPENAI_INTENT_ENABLED === "true";
const intentKey = process.env.OPENAI_API_KEY?.trim();
const intentLedger = process.env.OPENAI_INTENT_LEDGER_PATH;
const interpretIntent = intentEnabled && intentKey && intentLedger && isAbsolute(intentLedger)
  ? createOpenAIIntentInterpreter(intentKey, { ledgerPath: intentLedger })
  : undefined;
const researchTurns = createResearchTurns({
  interpretIntent,
  ...(configured && key && ledgerPath ? {
    research: createExaProductResearch(key, { diagnosticSink: researchDiagnosticPath(process.env) }), quota: createResearchQuota(ledgerPath, { manualGrantPath: process.env.EXA_MANUAL_RESEARCH_GRANT_PATH }),
  } : { unavailableReason: enabled ? "not-configured" as const : "disabled" as const }),
});
const composeApp = fixtureMode ? (await import("./test-fixture-app")).createFixtureApp : createApp;
const app = composeApp({
  mode: fixtureMode ? "test-fixture" : "research",
  researchAvailable: configured,
  ...(!fixtureMode ? { researchTurns } : {}),
  logger: (event) => process.stdout.write(`${JSON.stringify(event)}\n`),
}, config);
serve({ fetch: app.fetch, hostname: "127.0.0.1", port: config.apiPort });
process.stdout.write(`Fieldnote ${fixtureMode ? "test fixture" : "research"} API listening on http://127.0.0.1:${config.apiPort}\n`);
