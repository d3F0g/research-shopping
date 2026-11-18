import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import net from "node:net";
import assert from "node:assert/strict";
import { fixtureDatabase, run } from "./test-postgres.mjs";

const fixture = await fixtureDatabase();
const directory = await mkdtemp(join(tmpdir(), "fieldnote-history-restart-"));
const pool = new Pool({ connectionString: fixture.url });
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
  FIELDNOTE_TEST_LEDGER: join(directory, "ledger.json"),
};
let api;
let entry = "src/server/index.ts";
let logs = "";
const proof = [];
async function start() {
  api = spawn(process.execPath, ["--import", "tsx", entry], {
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
  const account = await load(cookie);
  const legacy = JSON.parse(
    await readFile(
      "tests/fixtures/research-history/unversioned-application-response.json",
      "utf8",
    ),
  );
  const data = (
    await pool.query("SELECT data FROM shopping_workspace WHERE user_id = $1", [
      account.user.id,
    ])
  ).rows[0].data;
  data.turns = [
    {
      id: randomUUID(),
      operationId: randomUUID(),
      digest: "a".repeat(64),
      createdAt: new Date().toISOString(),
      message: "Historical capture fixture",
      request: {
        message: "Historical capture fixture",
        preferences: legacy.preferences,
      },
      body: { status: "complete", value: legacy },
    },
  ];
  await pool.query(
    "UPDATE shopping_workspace SET data = $2::jsonb WHERE user_id = $1",
    [account.user.id, JSON.stringify(data)],
  );
  await stop();
  entry = "tests/personalization-e2e/server.ts";
  await start();
  const loaded = (await load(cookie)).workspace;
  assert.deepEqual(loaded.turns, data.turns);
  const freshId = randomUUID();
  const freshCommand = {
    revision: loaded.revision,
    operationId: freshId,
    command: { kind: "message", text: "headphones under SGD250" },
  };
  const fresh = await post("/api/workspace", freshCommand, cookie);
  assert.equal(fresh.status, 200);
  const mixed = (await fresh.json()).workspace;
  assert.deepEqual(mixed.turns[0], data.turns[0]);
  assert.equal(mixed.turns[1].body.value.research.evidenceVersion, 2);
  assert.equal(
    mixed.turns[1].body.value.research.products[0].price.quote,
    "S$ 249 was S$ 349 SGD You Save S$ 100",
  );
  assert.deepEqual(mixed.turns[1].body.value.research.products[1].facts, []);
  const ledger = await readFile(environment.FIELDNOTE_TEST_LEDGER, "utf8");
  await stop();
  await pool.end();
  await fixture.restart();
  await start();
  assert.deepEqual((await load(cookie)).workspace, mixed);
  assert.deepEqual(
    (await (await post("/api/workspace", freshCommand, cookie)).json())
      .workspace,
    mixed,
  );
  assert.equal(
    await readFile(environment.FIELDNOTE_TEST_LEDGER, "utf8"),
    ledger,
  );
  const later = await post(
    "/api/workspace",
    {
      revision: mixed.revision,
      operationId: randomUUID(),
      command: { kind: "message", text: "thanks" },
    },
    cookie,
  );
  const after = (await later.json()).workspace;
  assert.deepEqual(after.turns.slice(0, 2), mixed.turns);
  assert.equal(after.preferences.hard.budget.amount, 250);
  assert.equal(after.turns[0].body.value.preferences.hard.budget.amount, 400);
  assert.equal(
    await readFile(environment.FIELDNOTE_TEST_LEDGER, "utf8"),
    ledger,
  );
  proof.push(
    "Actual unmodified legacy capture and newly completed v2 price context and identity-only lead survived API and PostgreSQL restart, duplicate commands and ordinary follow-ups. Hydration and replay left the provider admission ledger unchanged.",
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
  if (!pool.ended) await pool.end();
  await fixture.stop();
  await rm(directory, { recursive: true });
}
