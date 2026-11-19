import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { accountRuntime } from "./account-test-runtime.mjs";
const runtime = await accountRuntime();
const pool = new Pool({ connectionString: runtime.database });
const post = (path, body, cookie = "") =>
  fetch(`${runtime.apiOrigin}${path}`, {
    method: "POST",
    headers: {
      origin: runtime.origin,
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify(body),
  });
const load = (cookie) =>
  fetch(`${runtime.apiOrigin}/api/account`, { headers: { cookie } }).then((r) =>
    r.json(),
  );
try {
  const signup = await post("/api/auth/sign-up/email", {
    name: "Fixture crash",
    email: `fixture-crash-${randomUUID()}@example.test`,
    password: "fixture-crash-password-only",
  });
  assert.equal(signup.status, 200);
  const user = await signup.json();
  const cookie = signup.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  const account = await load(cookie);
  const operationId = randomUUID();
  const prepared = await post(
    "/api/workspace",
    {
      phase: "prepare",
      revision: account.workspace.revision,
      operationId,
      message: "I want a slow fixture powerbank under SGD40",
    },
    cookie,
  ).then((r) => r.json());
  const input = {
    phase: "research",
    revision: prepared.workspace.revision,
    preparedId: prepared.workspace.pendingPreparedId,
  };
  const pending = post("/api/workspace", input, cookie).catch(() => null);
  for (let i = 0; i < 100; i++) {
    const stats = await fetch(`${runtime.apiOrigin}/api/test-stats`).then((r) =>
      r.json(),
    );
    if (stats.calls === 1) break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  const before = await readFile(runtime.ledger, "utf8");
  const ledger = JSON.parse(before);
  assert.equal(ledger.attempts.length, 1);
  assert.equal(ledger.attempts[0].state, "pending");
  assert.equal(ledger.attempts[0].reservedUsd, 0.05);
  await runtime.crash();
  await pending;
  await runtime.start();
  const restored = await load(cookie);
  assert.equal(restored.status, "signed-in");
  assert.equal(restored.workspace.pendingPreparedId, input.preparedId);
  const replay = await post("/api/workspace", input, cookie).then((r) =>
    r.json(),
  );
  assert.equal(replay.operation.status, "running");
  assert.equal(replay.response, null);
  assert.equal(await readFile(runtime.ledger, "utf8"), before);
  assert.equal(
    (await fetch(`${runtime.apiOrigin}/api/test-stats`).then((r) => r.json()))
      .calls,
    0,
  );
  await pool.query(
    "UPDATE fieldnote_v2_workspace SET data=jsonb_set(data, '{pending,deadline}', $2::jsonb) WHERE user_id=$1",
    [user.user.id, JSON.stringify(new Date(Date.now() - 1).toISOString())],
  );
  const expired = await load(cookie);
  assert.equal(expired.workspace.pendingPreparedId, null);
  assert.equal(
    expired.workspace.state.messages.some((m) => m.research),
    false,
  );
  const newer = await post(
    "/api/workspace",
    {
      phase: "prepare",
      revision: expired.workspace.revision,
      operationId: randomUUID(),
      message: "I want a USB-C powerbank under SGD40",
    },
    cookie,
  ).then((r) => r.json());
  const blocked = await post(
    "/api/workspace",
    {
      phase: "research",
      revision: newer.workspace.revision,
      preparedId: newer.workspace.pendingPreparedId,
    },
    cookie,
  ).then((r) => r.json());
  assert.equal(blocked.response.kind, "research-unavailable");
  assert.equal(blocked.response.reason, "busy");
  assert.equal(
    (await fetch(`${runtime.apiOrigin}/api/test-stats`).then((r) => r.json()))
      .calls,
    0,
  );
  assert.equal(await readFile(runtime.ledger, "utf8"), before);
  await mkdir("artifacts/fieldnote-v2/security/accounts", { recursive: true });
  await writeFile(
    "artifacts/fieldnote-v2/security/accounts/crash.json",
    JSON.stringify(
      {
        status: "passed",
        proof: [
          "SIGKILL during actual loopback SDK body consumption retains one pending US$0.05 reservation.",
          "API process restart restores the persisted running claim and duplicate dispatch spends nothing.",
          "After the fixture deadline is explicitly aged, new research remains blocked by the uncertain persistent reservation.",
          "No late result publishes and the original ledger bytes remain unchanged.",
        ],
        limits: [
          "Explicit local test substitute. No live Exa request or charge.",
          "Expiry uses an aged fixture database timestamp rather than waiting two minutes.",
        ],
      },
      null,
      2,
    ) + "\n",
  );
  process.stdout.write(
    "Actual process crash, duplicate replay, persistent reservation and recovery checks passed.\n",
  );
} finally {
  await pool.end();
  await runtime.close();
}
