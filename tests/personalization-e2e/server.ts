import { serve } from "@hono/node-server";
import {
  configuredAccounts,
  accountConfiguration,
} from "../../src/server/accounts";
import { createApp } from "../../src/server/app";
import { createResearchTurns } from "../../src/server/research-turns";
import { createResearchQuota } from "../../src/server/research-quota";
import { configFromEnvironment } from "../../src/server/config";

if (
  process.env.NODE_ENV !== "test" ||
  process.env.EXA_RESEARCH_ENABLED !== "false" ||
  !process.env.FIELDNOTE_TEST_LEDGER
)
  throw new Error("Use the explicit offline personalization fixture runner");
const turns = createResearchTurns({
  quota: createResearchQuota(process.env.FIELDNOTE_TEST_LEDGER),
  research: async (request) => {
    if (request.preferences.hard.budget?.amount === 201)
      await new Promise((resolve) => setTimeout(resolve, 1800));
    return {
      status: "ready",
      research: {
        dataKind: "web-research",
        retrievedAt: "2026-11-18T00:00:00.000Z",
        requestId: "automated-fixture",
        reportedCostUsd: 0,
        products: [
          {
            id: "fixture-headphones",
            name: "Automated fixture headphones",
            facts: [
              {
                sourceId: "fixture-source",
                quote: "Automated fixture headphones have wireless audio.",
              },
            ],
            price: null,
            stock: "unverified",
            unresolvedConstraints: [
              "Automated fixture data. Price, stock and delivery are unknown.",
            ],
          },
        ],
        sources: [
          {
            id: "fixture-source",
            title: "Automated fixture source",
            url: "https://example.com/fixture-headphones",
            highlights: ["Automated fixture headphones have wireless audio."],
          },
        ],
        limitations: [
          "Automated fixture data. This is not current product evidence.",
        ],
        grounding: [],
      },
    };
  },
});
const configuration = configFromEnvironment(process.env);
const accounts = await configuredAccounts(
  accountConfiguration(process.env),
  turns,
);
const app = createApp(
  {
    accounts: accounts.accounts,
    accountCapability: accounts.capability,
    researchTurns: turns,
    researchAvailable: true,
  },
  configuration,
);
const server = serve({
  fetch: app.fetch,
  hostname: "127.0.0.1",
  port: configuration.apiPort,
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    server.close();
    void accounts.close().then(() => process.exit(0));
  });
