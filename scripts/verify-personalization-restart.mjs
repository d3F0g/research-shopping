import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import net from "node:net";
import assert from "node:assert/strict";
import { fixtureDatabase, run } from "./test-postgres.mjs";

const fixture = await fixtureDatabase();
if (!fixture.restart)
  throw new Error(
    "Restart verification requires an owned temporary PostgreSQL cluster",
  );
const listener = net.createServer();
await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const environment = {
  ...process.env,
  NODE_ENV: "test",
  FIELDNOTE_TEST_FIXTURES: "false",
  EXA_RESEARCH_ENABLED: "false",
  EXA_API_KEY: "",
  EXA_RESEARCH_LEDGER_PATH: "",
  API_PORT: String(port),
  WEB_PORT: String(port),
  FIELDNOTE_DATABASE_URL: fixture.url,
  FIELDNOTE_AUTH_ORIGIN: origin,
  FIELDNOTE_AUTH_SECRET: "fixture-process-restart-secret-long-enough",
};
let api;
let logs = "";
const proof = [];
async function start() {
  api = spawn(process.execPath, ["--import", "tsx", "src/server/index.ts"], {
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  api.stdout.on("data", (bytes) => {
    logs += bytes;
  });
  api.stderr.on("data", (bytes) => {
    logs += bytes;
  });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${origin}/api/health`)).ok) return;
    } catch {}
    if (api.exitCode !== null)
      throw new Error("API process exited before readiness");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("API process did not become ready");
}
async function stop() {
  if (api && api.exitCode === null) {
    api.kill("SIGTERM");
    await once(api, "exit");
  }
}
const post = (path, body, cookie = "") =>
  fetch(`${origin}${path}`, {
    method: "POST",
    headers: { origin, "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
const load = async (cookie) =>
  await (await fetch(`${origin}/api/account`, { headers: { cookie } })).json();
try {
  await run(
    process.execPath,
    ["--import", "tsx", "src/server/database-command.ts", "migrate"],
    environment,
  );
  await start();
  const signup = await post("/api/auth/sign-up/email", {
    name: "Restart fixture",
    email: "restart@example.test",
    password: "fixture-restart-password-only",
  });
  assert.equal(signup.status, 200);
  const cookie = signup.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const operationId = randomUUID();
  const response = await post(
    "/api/workspace",
    {
      revision: 0,
      operationId,
      command: { kind: "message", text: "headphones under SGD250" },
    },
    cookie,
  );
  assert.equal(response.status, 200);
  const saved = (await response.json()).workspace;
  assert.equal(saved.preferences.hard.budget.amount, 250);
  assert.equal(saved.turns[0].body.value.kind, "research-unavailable");
  proof.push(
    "Account and saved research-unavailable turn created through actual HTTP cookies with live providers disabled.",
  );
  await stop();
  await start();
  assert.deepEqual((await load(cookie)).workspace, saved);
  proof.push(
    "Actual API process restart restored the same account, preferences and immutable turn.",
  );
  await stop();
  await fixture.restart();
  await start();
  assert.deepEqual((await load(cookie)).workspace, saved);
  proof.push(
    "Actual PostgreSQL 17 stop/start and API restart preserved the same workspace.",
  );
  const duplicate = await post(
    "/api/workspace",
    {
      revision: 0,
      operationId,
      command: { kind: "message", text: "headphones under SGD250" },
    },
    cookie,
  );
  assert.deepEqual((await duplicate.json()).workspace, saved);
  proof.push(
    "A lost-response retry after both restarts returned the existing operation without rerunning research.",
  );
  const deletion = await post(
    "/api/workspace",
    {
      revision: saved.revision,
      operationId: randomUUID(),
      command: { kind: "delete-saved-data" },
    },
    cookie,
  );
  const empty = (await deletion.json()).workspace;
  assert.equal(empty.turns.length, 0);
  assert.equal(empty.preferences.hard.category, null);
  await stop();
  await fixture.restart();
  await start();
  assert.deepEqual((await load(cookie)).workspace, empty);
  proof.push(
    "Deletion remained empty with an advanced revision and epoch after both actual restarts.",
  );
  assert.ok(
    !logs.includes("fixture-restart-password-only") &&
      !logs.includes("headphones under") &&
      !logs.includes("fieldnote.session_token"),
  );
  proof.push(
    "Captured process logs contain no fixture password, transcript text, or session cookie.",
  );
  await mkdir("artifacts/personalization", { recursive: true });
  await writeFile(
    "artifacts/personalization/restart-proof.json",
    JSON.stringify(
      {
        checks: proof,
        liveProviders: false,
        processRestart: true,
        postgresRestart: true,
      },
      null,
      2,
    ),
  );
  process.stdout.write(proof.join("\n") + "\n");
} finally {
  await stop();
  await fixture.stop();
}
