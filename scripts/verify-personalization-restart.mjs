import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import net from "node:net";
import { fixtureDatabase, run } from "./test-postgres.mjs";

const fixture = await fixtureDatabase();
const listener = net.createServer();
await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const environment = { ...process.env, NODE_ENV: "test", API_PORT: String(port), WEB_PORT: String(port), FIELDNOTE_DATABASE_URL: fixture.url, FIELDNOTE_AUTH_ORIGIN: origin, FIELDNOTE_AUTH_SECRET: "fixture-v2-process-restart-secret-long-enough", EXA_RESEARCH_ENABLED: "false", EXA_API_KEY: "", EXA_RESEARCH_LEDGER_PATH: "", FIELDNOTE_TEST_FIXTURES: "false" };
let api;
let logs = "";
const proof = [];
async function start() {
  api = spawn(process.execPath, ["--import", "tsx", "src/server/index.ts"], { env: environment, stdio: ["ignore", "pipe", "pipe"] });
  api.stdout.on("data", (bytes) => { logs += bytes; });
  api.stderr.on("data", (bytes) => { logs += bytes; });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${origin}/api/health`)).ok) return; } catch {}
    if (api.exitCode !== null) throw new Error("API process exited before readiness.");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("API process did not become ready.");
}
async function stop() { if (api && api.exitCode === null) { api.kill("SIGTERM"); await once(api, "exit"); } }
const post = (path, body, cookie = "") => fetch(`${origin}${path}`, { method: "POST", headers: { origin, "content-type": "application/json", cookie }, body: JSON.stringify(body) });
async function load(cookie) { const response = await fetch(`${origin}/api/account`, { headers: { cookie } }); assert.equal(response.status, 200); return response.json(); }
try {
  await run(process.execPath, ["--import", "tsx", "src/server/database-command.ts", "migrate"], environment);
  await start();
  const signup = await post("/api/auth/sign-up/email", { name: "Restart fixture", email: "fixture-restart@example.test", password: "fixture-restart-password-only" });
  assert.equal(signup.status, 200);
  const cookie = signup.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
  const initial = await load(cookie);
  assert.equal(initial.status, "signed-in");
  const question = await post("/api/workspace", { phase: "prepare", revision: initial.workspace.revision, operationId: randomUUID(), message: "I want a powerbank around $30-40." }, cookie);
  assert.equal(question.status, 200);
  const pending = (await question.json()).workspace;
  assert.equal(pending.state.pending.kind, "currency");
  await stop(); await start();
  assert.deepEqual((await load(cookie)).workspace, pending);
  proof.push("The actual API process restored the original typed currency draft after restart.");
  const answer = await post("/api/workspace", { phase: "prepare", revision: pending.revision, operationId: randomUUID(), questionId: pending.state.pending.id, message: "SGD." }, cookie);
  assert.equal(answer.status, 200);
  const prepared = (await answer.json()).workspace;
  assert.deepEqual(prepared.state.intent.budget, { minimum: 30, maximum: 40, currency: "SGD" });
  const research = await post("/api/workspace", { phase: "research", revision: prepared.revision, preparedId: prepared.pendingPreparedId }, cookie);
  assert.equal(research.status, 200);
  const researchResult = await research.json();
  assert.equal(researchResult.response.kind, "research-unavailable");
  assert.equal(researchResult.response.reason, "disabled");
  const saved = researchResult.workspace;
  proof.push("The actual server resumed SGD30-40, retained both bounds and saved an honest disabled-provider response without any paid call.");
  await stop(); await fixture.restart(); await start();
  assert.deepEqual((await load(cookie)).workspace, saved);
  proof.push("A PostgreSQL restart and a second API process restart preserved the same account, accepted intent and immutable messages.");
  const deleted = await post("/api/workspace", { phase: "delete-saved-data", revision: saved.revision, operationId: randomUUID() }, cookie);
  assert.equal(deleted.status, 200);
  await stop(); await start();
  const cleared = await load(cookie);
  assert.equal(cleared.status, "signed-in");
  assert.deepEqual(cleared.workspace.state.messages, []);
  assert.equal(cleared.workspace.state.intent.budget, null);
  proof.push("Shopping deletion survived restart while the sign-in account remained valid.");
  await mkdir("artifacts/fieldnote-v2/accounts", { recursive: true });
  await writeFile("artifacts/fieldnote-v2/accounts/restart.json", JSON.stringify({ status: "passed", scope: "Actual normal API entry point, Better Auth cookies and owned temporary PostgreSQL17", proof, limits: ["Exa is disabled. This does not establish live research usefulness.", "This is author verification. Independent QA and security review remain required."] }, null, 2) + "\n");
  process.stdout.write(proof.join("\n") + "\n");
} catch (error) { process.stderr.write(logs); throw error; }
finally { await stop(); await fixture.stop(); }
