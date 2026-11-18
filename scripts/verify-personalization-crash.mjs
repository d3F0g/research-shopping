import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import net from "node:net";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { fixtureDatabase, run } from "./test-postgres.mjs";

const fixture = await fixtureDatabase();
const directory = await mkdtemp(join(tmpdir(), "fieldnote-crash-fixture-"));
const providerLog = join(directory, "provider.log");
await writeFile(providerLog, "");
const pool = new Pool({ connectionString: fixture.url });
const listener = net.createServer();
await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const env = {
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
  FIELDNOTE_AUTH_SECRET: "fixture-crash-local-secret-long-enough",
  FIELDNOTE_CRASH_PROVIDER_LOG: providerLog,
};
let api;
let observed;
let logs = "";
const proof = [];
async function start(stage = "") {
  api = spawn(
    process.execPath,
    ["--import", "tsx", "tests/postgres/crash-server.ts"],
    {
      env: { ...env, FIELDNOTE_CRASH_STAGE: stage },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    },
  );
  api.stdout.on("data", (bytes) => {
    logs += bytes;
  });
  api.stderr.on("data", (bytes) => {
    logs += bytes;
  });
  observed = new Promise((resolve) => api.once("message", resolve));
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${origin}/api/health`)).ok) return;
    } catch {}
    if (api.exitCode !== null) throw new Error("Crash fixture API exited");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Crash fixture API did not become ready");
}
async function stop(signal = "SIGTERM") {
  if (api && api.exitCode === null) {
    api.kill(signal);
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
    env,
  );
  await start();
  const signup = await post("/api/auth/sign-up/email", {
    name: "Crash fixture",
    email: `crash-${randomUUID()}@example.test`,
    password: "fixture-crash-password-only",
  });
  assert.equal(signup.status, 200);
  const cookie = signup.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const userId = (await signup.json()).user.id;
  for (const stage of [
    "accepted",
    "dispatched",
    "provider-returned",
    "committed",
  ]) {
    const current = await load(cookie);
    const reset = await post(
      "/api/workspace",
      {
        revision: current.workspace.revision,
        operationId: randomUUID(),
        command: { kind: "new-chat" },
      },
      cookie,
    );
    const revision = (await reset.json()).workspace.revision;
    await stop();
    await start(stage);
    const operationId = randomUUID();
    const input = {
      revision,
      operationId,
      command: { kind: "message", text: "headphones under SGD230" },
    };
    const response = post("/api/workspace", input, cookie).catch(() => null);
    const event = await Promise.race([
      observed,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Crash stage was not observed")),
          10_000,
        ).unref(),
      ),
    ]);
    assert.equal(event.event, stage);
    await stop("SIGKILL");
    await response;
    const row = (
      await pool.query(
        "SELECT data FROM shopping_workspace WHERE user_id = $1",
        [userId],
      )
    ).rows[0].data;
    assert.equal(row.turns.length, 1);
    if (stage !== "committed") {
      assert.equal(row.turns[0].body.status, "pending");
      await pool.query(
        "UPDATE shopping_workspace SET data = jsonb_set(data, '{pending,deadline}', $2::jsonb) WHERE user_id = $1",
        [userId, JSON.stringify(new Date(Date.now() - 1000).toISOString())],
      );
    } else assert.equal(row.turns[0].body.status, "complete");
    const before = await readFile(providerLog, "utf8");
    await start();
    const replay = await post("/api/workspace", input, cookie);
    assert.equal(replay.status, 200);
    const saved = await replay.json();
    assert.equal(
      saved.operation.status,
      stage === "committed" ? "complete" : "interrupted",
    );
    assert.equal(await readFile(providerLog, "utf8"), before);
    assert.equal(
      before.split("\n").filter((id) => id === operationId).length,
      stage === "accepted" ? 0 : 1,
    );
    proof.push(
      `Killed the actual API at ${stage}. Accepted input survived and retry did not dispatch another provider request.`,
    );
  }
  assert.ok(
    !logs.includes("fixture-crash-password-only") &&
      !logs.includes("headphones under") &&
      !logs.includes("fieldnote.session_token"),
  );
  await mkdir("artifacts/personalization", { recursive: true });
  await writeFile(
    "artifacts/personalization/crash-proof.json",
    JSON.stringify(
      {
        checks: proof,
        liveProviders: false,
        actualProcessKills: 4,
        exactlyOnceBillingClaimed: false,
      },
      null,
      2,
    ),
  );
  process.stdout.write(proof.join("\n") + "\n");
} finally {
  await stop();
  await pool.end();
  await fixture.stop();
  await rm(directory, { recursive: true });
}
