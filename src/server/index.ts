import { serve } from "@hono/node-server";
import { isAbsolute } from "node:path";
import { createApp } from "./app";
import { configFromEnvironment } from "./config";
import { createExaProductResearch } from "./exa-research";
import { createResearchQuota } from "./research-quota";
import { createConversationService } from "./conversations";
import { accountConfiguration, configuredAccounts } from "./accounts";
import { createResearchExecutor } from "./research-executor";
import { reduceTurn } from "../domain/turn-reducer";

const config = configFromEnvironment(process.env);
const enabled =
  process.env.NODE_ENV === "development" &&
  process.env.EXA_RESEARCH_ENABLED !== "false";
const key = process.env.EXA_API_KEY?.trim();
const ledger = process.env.EXA_RESEARCH_LEDGER_PATH;
const configured = enabled && key && ledger && isAbsolute(ledger);
const researchDependencies = configured
  ? {
      research: createExaProductResearch(key),
      quota: createResearchQuota(ledger, {
        manualGrantPath: process.env.EXA_MANUAL_RESEARCH_GRANT_PATH,
      }),
    }
  : {
      unavailableReason: enabled
        ? ("not-configured" as const)
        : ("disabled" as const),
    };
const conversations = createConversationService(researchDependencies);
const accounts = await configuredAccounts(accountConfiguration(process.env), {
  reduce: reduceTurn,
  research: createResearchExecutor(researchDependencies),
});
const app = createApp(
  {
    conversations,
    accounts: accounts.accounts,
    accountCapability: accounts.capability,
  },
  config,
);
serve({ fetch: app.fetch, hostname: "127.0.0.1", port: config.apiPort });
process.stdout.write(
  `Fieldnote V2 Exa research API listening on http://127.0.0.1:${config.apiPort}\n`,
);
