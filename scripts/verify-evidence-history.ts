import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { Pool } from "pg";
import { accountRuntime } from "./account-test-runtime.mjs";
import { emptyWorkspace } from "../src/domain/workspace";
import { actualStoredConversationV3 } from "../tests/helpers/v3-stored-material";
import { actualStoredConversationV2 } from "../tests/helpers/v2-stored-material";

const runtime = await accountRuntime({ web: true });
const browser = await chromium.launch();
const directory = "artifacts/fieldnote-v4/history-browser";
await mkdir(directory, { recursive: true });
const proof = { commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), worktree: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(), status: "failed", cleanup: false, checks: [] as string[], screenshots: [] as string[], limitations: ["Synthetic source format and local SDK traffic only. No private capture, paid research, live usefulness or merchant verification.", "Independent visual and security review remains required."] };
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, colorScheme: "light" });
    await context.route("https://**", (route) => route.abort());
    const signup = await context.request.post(`${runtime.origin}/api/auth/sign-up/email`, { headers: { origin: runtime.origin }, data: { name: "Fixture evidence shopper", email: `fixture-history-${randomUUID()}@example.test`, password: "fixture-history-password-only" } });
    assert.equal(signup.status(), 200);
    const user = (await signup.json()).user;
    await context.request.get(`${runtime.origin}/api/account`);
    const pool = new Pool({ connectionString: runtime.database });
    const old = { ...emptyWorkspace(), schema: 3 };
    old.state = actualStoredConversationV3();
    old.state.messages.unshift(...actualStoredConversationV2().messages);
    old.state.messages.unshift({ id: "fixture-history-label", role: "assistant", text: "Fixture data. Historical automated V2 and V3 evidence follows unchanged." });
    const historicalName = old.state.messages.find((message) => message.research)!.research!.products[0]!.name;
    const operationId = randomUUID(), preparedId = randomUUID(), stamp = new Date().toISOString();
    old.receipts = [{ operationId, preparedId, digest: "a".repeat(64), status: "prepared", createdAt: stamp }];
    const session = (await pool.query('SELECT id FROM "session" WHERE "userId"=$1', [user.id])).rows[0];
    old.pending = { operationId, preparedId, sessionId: session.id, revision: 0, epoch: 0, intentDigest: "b".repeat(64), deadline: new Date(Date.now() + 120_000).toISOString(), status: "prepared" };
    await pool.query("UPDATE fieldnote_v2_workspace SET data=$2::jsonb WHERE user_id=$1", [user.id, JSON.stringify(old)]);
    await pool.end();
    const page = await context.newPage();
    const initialEvents: { event: string; at: number; status?: number; message?: string }[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/account") initialEvents.push({ event: "account-request", at: Date.now() });
    });
    page.on("response", (response) => {
      if (new URL(response.url()).pathname === "/api/account") initialEvents.push({ event: "account-response", at: Date.now(), status: response.status() });
    });
    page.on("requestfailed", (request) => {
      if (new URL(request.url()).pathname === "/api/account") initialEvents.push({ event: "account-failed", at: Date.now(), message: request.failure()?.errorText });
    });
    page.on("pageerror", (error) => initialEvents.push({ event: "page-error", at: Date.now(), message: error.message }));
    if (viewport.width === 390) {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditionsByRule", { matchedNetworkConditions: [{ urlPattern: `${runtime.origin}/api/account`, latency: 5500, downloadThroughput: -1, uploadThroughput: -1 }] });
    }
    try {
      const [initialResponse] = await Promise.all([
        page.waitForResponse((response) => response.url() === `${runtime.origin}/api/account` && response.request().method() === "GET"),
        page.goto(runtime.origin).then(() => initialEvents.push({ event: "page-loaded", at: Date.now() })),
      ]);
      assert.equal(initialResponse.status(), 200);
      const initial = await initialResponse.json();
      assert.equal(initial.status, "signed-in");
      assert.deepEqual(initial.workspace.state.messages, old.state.messages);
      assert.equal(initial.workspace.pendingPreparedId, null);
      initialEvents.push({ event: "account-validated", at: Date.now() });
      await expect(page.getByText(historicalName, { exact: true }).first()).toBeVisible();
      await writeFile(`${directory}/${viewport.width}-initial.json`, JSON.stringify({ status: "passed", accountLatencyMs: viewport.width === 390 ? 5500 : 0, events: initialEvents }, null, 2) + "\n");
    } catch (error) {
      await writeFile(`${directory}/${viewport.width}-initial-failure.json`, JSON.stringify({ events: initialEvents, bodyTextPrefix: (await page.locator("body").innerText()).slice(0, 30000) }, null, 2) + "\n");
      const failurePath = `${directory}/${viewport.width}-initial-failure.png`;
      await page.screenshot({ path: failurePath }); proof.screenshots.push(failurePath);
      throw error;
    }
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
    const illustration = page.getByRole("img", { name: "Source illustration for Fixture Meridian Sunglasses - Silver", exact: true });
    await expect(illustration).toHaveCount(0);
    const initialPath = `${directory}/${viewport.width}-current-observation.png`;
    await page.screenshot({ path: initialPath }); proof.screenshots.push(initialPath);
    const disclosure = page.getByRole("button", { name: "Evidence and tradeoffs for Fixture Meridian Sunglasses - Silver" });
    await disclosure.click();
    await expect.poll(() => disclosure.evaluate((element) => element.parentElement!.querySelector("[data-slot=trace-collapsible-content]")!.getAnimations().length)).toBe(0);
    const provenance = page.getByText("Literal source passage. Provider wording differs only in whitespace.", { exact: true });
    await provenance.scrollIntoViewIfNeeded();
    await expect(provenance).toBeVisible();
    const quoted = page.locator("blockquote").filter({ hasText: "Fixture Meridian Sunglasses - Silver" }).first();
    assert.match(await quoted.innerText(), /Silver \n\n SGD 868/);
    await quoted.evaluate((element) => element.scrollIntoView({ block: "center" }));
    const quoteBox = await quoted.boundingBox();
    const composerBox = await page.getByRole("textbox", { name: "Message", exact: true }).boundingBox();
    assert(quoteBox && composerBox && quoteBox.y >= 56 && quoteBox.y + quoteBox.height <= composerBox.y);
    await expect(page.getByRole("textbox", { name: "Message", exact: true })).toBeInViewport();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    const evidencePath = `${directory}/${viewport.width}-literal-evidence.png`;
    await page.screenshot({ path: evidencePath, animations: "disabled" }); proof.screenshots.push(evidencePath);
    const saved = await context.request.get(`${runtime.origin}/api/account`).then((response) => response.json());
    assert.deepEqual(saved.workspace.state.messages.slice(0, old.state.messages.length), old.state.messages);
    assert.deepEqual(saved.workspace.state.messages.filter((message: { research?: unknown }) => message.research).map((message: { research: { evidenceVersion: number } }) => message.research.evidenceVersion), [2, 3, 4]);
    const separate = await browser.newContext();
    const isolatedSignup = await separate.request.post(`${runtime.origin}/api/auth/sign-up/email`, { headers: { origin: runtime.origin }, data: { name: "Fixture isolated shopper", email: `fixture-isolated-${randomUUID()}@example.test`, password: "fixture-history-password-only" } });
    assert.equal(isolatedSignup.status(), 200);
    assert.deepEqual((await separate.request.get(`${runtime.origin}/api/account`).then((response) => response.json())).workspace.state.messages, []);
    await separate.close();
    await runtime.restartDatabase();
    assert.deepEqual((await context.request.get(`${runtime.origin}/api/account`).then((response) => response.json())).workspace, saved.workspace);
    const reloadEvents: { event: string; at: number; status?: number; message?: string }[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/account") reloadEvents.push({ event: "account-request", at: Date.now() });
    });
    page.on("response", (response) => {
      if (new URL(response.url()).pathname === "/api/account") reloadEvents.push({ event: "account-response", at: Date.now(), status: response.status() });
    });
    page.on("requestfailed", (request) => {
      if (new URL(request.url()).pathname === "/api/account") reloadEvents.push({ event: "account-failed", at: Date.now(), message: request.failure()?.errorText });
    });
    page.on("pageerror", (error) => reloadEvents.push({ event: "page-error", at: Date.now(), message: error.message }));
    try {
      const [restoredResponse] = await Promise.all([
        page.waitForResponse((response) => response.url() === `${runtime.origin}/api/account` && response.request().method() === "GET"),
        page.reload().then(() => reloadEvents.push({ event: "page-loaded", at: Date.now() })),
      ]);
      assert.equal(restoredResponse.status(), 200);
      const restored = await restoredResponse.json();
      assert.equal(restored.status, "signed-in");
      assert.deepEqual(restored.workspace, saved.workspace);
      reloadEvents.push({ event: "account-validated", at: Date.now() });
      await expect(page.getByText("SGD 868.00", { exact: true })).toBeVisible();
      await writeFile(`${directory}/${viewport.width}-reload.json`, JSON.stringify({ status: "passed", accountLatencyMs: viewport.width === 390 ? 5500 : 0, events: reloadEvents }, null, 2) + "\n");
    } catch (error) {
      await writeFile(`${directory}/${viewport.width}-reload-failure.json`, JSON.stringify({ events: reloadEvents, bodyTextPrefix: (await page.locator("body").innerText()).slice(0, 30000) }, null, 2) + "\n");
      const failurePath = `${directory}/${viewport.width}-reload-failure.png`;
      await page.screenshot({ path: failurePath }); proof.screenshots.push(failurePath);
      throw error;
    }
    proof.checks.push(`${viewport.width}px browser preserved V2/V3 history, rendered V4 source-row observation without a qualifying variant price, blocked stale prepared work, isolated another account, and survived PostgreSQL/API restart.`);
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
