import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";
import { fixtureDatabase, run } from "./test-postgres.mjs";
const fixture = await fixtureDatabase();
const directory = await mkdtemp(join(tmpdir(), "fieldnote-browser-fixture-"));
async function port() {
  const listener = net.createServer();
  await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
  const number = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  return String(number);
}
const apiPort = await port();
const webPort = await port();
const env = {
  NODE_ENV: "test",
  API_PORT: apiPort,
  WEB_PORT: webPort,
  FIELDNOTE_DATABASE_URL: fixture.url,
  FIELDNOTE_TEST_DATABASE_URL: fixture.url,
  FIELDNOTE_AUTH_ORIGIN: `http://127.0.0.1:${webPort}`,
  FIELDNOTE_AUTH_SECRET: "fixture-browser-local-secret-long-enough",
  FIELDNOTE_TEST_LEDGER: join(directory, "ledger.json"),
};
try {
  await run(
    process.execPath,
    ["--import", "tsx", "src/server/database-command.ts", "migrate"],
    env,
  );
  for (const suite of ["accounts", "history"]) {
    await run(
      process.execPath,
      [
        "node_modules/@playwright/test/cli.js",
        "test",
        `${suite}.spec.ts`,
        "--config",
        "playwright.personalization.config.ts",
        `--output=artifacts/personalization/playwright-${suite}`,
      ],
      {
        ...env,
        FIELDNOTE_TEST_LEDGER: join(directory, `${suite}-ledger.json`),
      },
    );
  }
} finally {
  await fixture.stop();
  await rm(directory, { recursive: true });
}
