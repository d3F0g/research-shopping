import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { Pool } from "pg";
import { accountRuntime } from "./account-test-runtime.mjs";
import { emptyWorkspace } from "../src/domain/workspace";
import { storedResearchV2 } from "../tests/helpers/v2-stored-material";

const runtime = await accountRuntime({ web: true });
const browser = await chromium.launch();
const directory = "artifacts/fieldnote-v3/history-browser";
await mkdir(directory, { recursive: true });
const proof = { commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), worktree: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(), status: "failed", cleanup: false, checks: [] as string[], screenshots: [] as string[], limitations: ["Synthetic source format and local SDK traffic only. No private capture, paid research, live usefulness or merchant verification.", "Independent visual and security review remains required."] };
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, colorScheme: "light" });
    await context.route("https://**", (route) => route.request().resourceType() === "image"
      ? route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="100"><rect x="20" y="10" width="140" height="80" rx="8" fill="#777"/><text x="90" y="55" text-anchor="middle" fill="white">Fixture image</text></svg>' })
      : route.abort());
    const signup = await context.request.post(`${runtime.origin}/api/auth/sign-up/email`, { headers: { origin: runtime.origin }, data: { name: "Fixture evidence shopper", email: `fixture-history-${randomUUID()}@example.test`, password: "fixture-history-password-only" } });
    assert.equal(signup.status(), 200);
    const user = (await signup.json()).user;
    await context.request.get(`${runtime.origin}/api/account`);
    const pool = new Pool({ connectionString: runtime.database });
    const old = { ...emptyWorkspace(), schema: 2 };
    const research = storedResearchV2();
    old.state.messages = [{ id: "fixture-old-user", role: "user", text: "Fixture historical shopping request" }, { id: "fixture-old-answer", role: "assistant", text: research.summary, detail: "Fixture historical details", research }];
    const operationId = randomUUID(), preparedId = randomUUID(), stamp = new Date().toISOString();
    old.receipts = [{ operationId, preparedId, digest: "a".repeat(64), status: "prepared", createdAt: stamp }];
    const session = (await pool.query('SELECT id FROM "session" WHERE "userId"=$1', [user.id])).rows[0];
    old.pending = { operationId, preparedId, sessionId: session.id, revision: 0, epoch: 0, intentDigest: "b".repeat(64), deadline: new Date(Date.now() + 120_000).toISOString(), status: "prepared" };
    await pool.query("UPDATE fieldnote_v2_workspace SET data=$2::jsonb WHERE user_id=$1", [user.id, JSON.stringify(old)]);
    await pool.end();
    const page = await context.newPage();
    await page.goto(runtime.origin);
    await expect(page.getByText("Fixture historical item", { exact: true })).toBeVisible();
    const migrated = await context.request.get(`${runtime.origin}/api/account`).then((response) => response.json());
    assert.deepEqual(migrated.workspace.state.messages, old.state.messages);
    assert.equal(migrated.workspace.pendingPreparedId, null);
    const before = await context.request.get(`${runtime.origin}/api/test-stats`).then((response) => response.json());
    const stale = await context.request.post(`${runtime.origin}/api/workspace`, { headers: { origin: runtime.origin }, data: { phase: "research", revision: 0, preparedId } });
    assert.equal(stale.status(), 200);
    assert.equal((await stale.json()).operation.status, "interrupted");
    assert.deepEqual(await context.request.get(`${runtime.origin}/api/test-stats`).then((response) => response.json()), before);
    await page.getByRole("textbox", { name: "Message", exact: true }).fill("Find catalog fixture sunglasses between SGD800 and1000");
    await page.getByRole("button", { name: "Send message", exact: true }).click();
    const name = page.getByText("Fixture Meridian Sunglasses - Silver", { exact: true });
    await expect(name).toBeInViewport();
    await expect(page.getByText("SGD 868.00", { exact: true })).toBeVisible();
    await expect(page.getByText(/Provider-reported, unverified: Price as listed on Fixture Index/)).toBeVisible();
    const initialPath = `${directory}/${viewport.width}-current-observation.png`;
    await page.screenshot({ path: initialPath }); proof.screenshots.push(initialPath);
    const disclosure = page.getByRole("button", { name: "Evidence and tradeoffs for Fixture Meridian Sunglasses - Silver" });
    await disclosure.click();
    const provenance = page.getByText("Literal source passage. Provider wording differs only in whitespace.", { exact: true });
    await provenance.scrollIntoViewIfNeeded();
    await expect(provenance).toBeVisible();
    const quoted = page.locator("blockquote").filter({ hasText: "Fixture Meridian Sunglasses - Silver" }).first();
    assert.match(await quoted.innerText(), /Silver \n\n SGD 868/);
    await expect(page.getByRole("textbox", { name: "Message", exact: true })).toBeInViewport();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    const evidencePath = `${directory}/${viewport.width}-literal-evidence.png`;
    await page.screenshot({ path: evidencePath }); proof.screenshots.push(evidencePath);
    const saved = await context.request.get(`${runtime.origin}/api/account`).then((response) => response.json());
    assert.deepEqual(saved.workspace.state.messages.slice(0, old.state.messages.length), old.state.messages);
    assert.deepEqual(saved.workspace.state.messages.filter((message: { research?: unknown }) => message.research).map((message: { research: { evidenceVersion: number } }) => message.research.evidenceVersion), [2, 3]);
    const separate = await browser.newContext();
    const isolatedSignup = await separate.request.post(`${runtime.origin}/api/auth/sign-up/email`, { headers: { origin: runtime.origin }, data: { name: "Fixture isolated shopper", email: `fixture-isolated-${randomUUID()}@example.test`, password: "fixture-history-password-only" } });
    assert.equal(isolatedSignup.status(), 200);
    assert.deepEqual((await separate.request.get(`${runtime.origin}/api/account`).then((response) => response.json())).workspace.state.messages, []);
    await separate.close();
    await runtime.restartDatabase();
    assert.deepEqual((await context.request.get(`${runtime.origin}/api/account`).then((response) => response.json())).workspace, saved.workspace);
    await page.reload();
    await expect(page.getByText("SGD 868.00", { exact: true })).toBeVisible();
    proof.checks.push(`${viewport.width}px browser preserved V2 history, rendered V3 literal evidence and unresolved observed money, blocked stale prepared work, isolated another account, and survived PostgreSQL/API restart.`);
    await context.close();
  }
  proof.status = "passed";
} finally {
  await browser.close();
  await runtime.close();
  proof.cleanup = true;
  await writeFile(`${directory}/proof.json`, JSON.stringify(proof, null, 2) + "\n");
}
console.log(JSON.stringify(proof));
