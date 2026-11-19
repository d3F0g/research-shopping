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
    type DiagnosticEvent = Record<string, string | number | boolean | null>;
    const firstEvents: DiagnosticEvent[] = [], lastEvents: DiagnosticEvent[] = [];
    const requests = new Map<string, string>(), pendingRules = new Map<string, string>();
    let firstBytes = 0, lastBytes = 0, droppedEvents = 0, droppedRequests = 0, capturing = true;
    const ownedPath = (value: string) => {
      try {
        const url = new URL(value);
        if (url.origin !== runtime.origin) return null;
        const version = url.searchParams.get("v");
        return (url.pathname + (version && /^[a-f0-9]{8}$/.test(version) ? `?v=${version}` : "")).slice(0, 512);
      } catch { return null; }
    };
    const record = (event: string, fields: Record<string, string | number | boolean | null | undefined> = {}) => {
      if (!capturing) return;
      const entry: DiagnosticEvent = { event, at: Date.now() };
      for (const [key, value] of Object.entries(fields)) if (value !== undefined) entry[key] = typeof value === "string" ? value.slice(0, 512) : value;
      const bytes = Buffer.byteLength(JSON.stringify(entry));
      if (bytes > 4096) { droppedEvents++; return; }
      if (firstEvents.length < 64 && firstBytes + bytes <= 32_768) { firstEvents.push(entry); firstBytes += bytes; return; }
      lastEvents.push(entry); lastBytes += bytes;
      while (lastEvents.length > 512 || lastBytes > 196_608) { lastBytes -= Buffer.byteLength(JSON.stringify(lastEvents.shift())); droppedEvents++; }
    };
    page.on("request", (request) => {
      const path = ownedPath(request.url());
      if (path) record("request", { path, resourceType: request.resourceType(), method: request.method() });
    });
    page.on("response", (response) => {
      const path = ownedPath(response.url());
      if (path) record("response", { path, status: response.status(), statusText: response.statusText(), resourceType: response.request().resourceType(), contentType: response.headers()["content-type"], contentLength: response.headers()["content-length"] });
    });
    page.on("requestfailed", (request) => {
      const path = ownedPath(request.url());
      if (path) record("request-failed", { path, resourceType: request.resourceType(), message: request.failure()?.errorText });
    });
    page.on("console", (message) => {
      const location = message.location();
      const path = location.url ? ownedPath(location.url) : null;
      if (!location.url || path) record("console", { level: message.type(), path, message: message.text(), line: location.lineNumber });
    });
    page.on("pageerror", (error) => record("page-error", { message: error.message }));
    page.on("domcontentloaded", () => record("dom-content-loaded", { path: ownedPath(page.url()) }));
    page.on("load", () => record("load", { path: ownedPath(page.url()) }));
    await page.addInitScript(({ origin }) => {
      const errors: { tag: string; path: string }[] = [];
      Object.defineProperty(window, "__fixtureBootstrapErrors", { value: errors });
      window.addEventListener("error", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement) || errors.length >= 32) return;
        const source = target.getAttribute("src") ?? target.getAttribute("href");
        if (!source) return;
        const url = new URL(source, location.href);
        if (url.origin === origin) errors.push({ tag: target.tagName, path: url.pathname.slice(0, 512) });
      }, true);
    }, { origin: runtime.origin });
    const cdp = await context.newCDPSession(page);
    cdp.on("Network.requestWillBeSent", ({ requestId, request, type }) => {
      if (!capturing) return;
      const path = ownedPath(request.url);
      if (!path) return;
      if (requests.size >= 1024) { requests.delete(requests.keys().next().value!); droppedRequests++; }
      requests.set(requestId, path);
      record("cdp-request", { requestId, path, resourceType: type });
      if (pendingRules.has(requestId)) { record("applied-rule", { requestId, path, ruleId: pendingRules.get(requestId) }); pendingRules.delete(requestId); }
    });
    cdp.on("Network.requestWillBeSentExtraInfo", ({ requestId, appliedNetworkConditionsId }) => {
      if (!capturing || !appliedNetworkConditionsId) return;
      const path = requests.get(requestId);
      if (path) record("applied-rule", { requestId, path, ruleId: appliedNetworkConditionsId });
      else {
        if (pendingRules.size >= 1024) { pendingRules.delete(pendingRules.keys().next().value!); droppedRequests++; }
        pendingRules.set(requestId, appliedNetworkConditionsId);
      }
    });
    cdp.on("Network.responseReceived", ({ requestId, response, type }) => {
      const path = ownedPath(response.url);
      if (path) record("cdp-response", { requestId, path, status: response.status, statusText: response.statusText, mimeType: response.mimeType, resourceType: type, encodedDataLength: response.encodedDataLength, fromDiskCache: response.fromDiskCache, fromServiceWorker: response.fromServiceWorker });
    });
    cdp.on("Network.loadingFinished", ({ requestId, encodedDataLength }) => {
      const path = requests.get(requestId);
      if (path) record("cdp-finished", { requestId, path, encodedDataLength });
    });
    cdp.on("Network.loadingFailed", ({ requestId, errorText, canceled, blockedReason }) => {
      const path = requests.get(requestId);
      if (path) record("cdp-failed", { requestId, path, message: errorText, canceled, blockedReason });
    });
    await cdp.send("Network.enable");
    const writeBootstrap = async (phase: "initial" | "reload") => {
      const file = `${directory}/${viewport.width}-${phase}-bootstrap.json`;
      const diagnostics = { events: [...firstEvents, ...lastEvents], droppedEvents, droppedRequests, processes: runtime.diagnostics() };
      await writeFile(file, JSON.stringify(diagnostics, null, 2) + "\n");
      const documentState = await page.evaluate(({ origin }) => {
        const root = document.getElementById("root");
        return {
          readyState: document.readyState, title: document.title.slice(0, 128), bodyPresent: !!document.body, rootPresent: !!root,
          rootChildCount: root?.childElementCount ?? 0, bodyTextLength: document.body?.innerText.length ?? 0,
          htmlLength: document.documentElement.outerHTML.length, rootHtmlLength: root?.innerHTML.length ?? 0,
          background: getComputedStyle(document.documentElement).backgroundColor,
          scripts: [...document.scripts].slice(0, 32).map((script) => { const url = new URL(script.src || location.href); return { type: script.type, path: url.origin === origin ? url.pathname.slice(0, 512) : null }; }),
          resourceErrors: (window as unknown as { __fixtureBootstrapErrors: { tag: string; path: string }[] }).__fixtureBootstrapErrors,
        };
      }, { origin: runtime.origin }).catch((error: Error) => ({ captureError: error.message.slice(0, 512) }));
      await writeFile(file, JSON.stringify({ ...diagnostics, documentState }, null, 2) + "\n");
      capturing = false;
    };
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
      const { ruleIds } = await cdp.send("Network.emulateNetworkConditionsByRule", { matchedNetworkConditions: [{ urlPattern: `${runtime.origin}/api/account`, latency: 5500, downloadThroughput: -1, uploadThroughput: -1 }] });
      for (const ruleId of ruleIds) record("configured-rule", { ruleId, path: "/api/account", latency: 5500 });
    }
    try {
      const [initialResponse] = await Promise.all([
        page.waitForResponse((response) => response.url() === `${runtime.origin}/api/account` && response.request().method() === "GET"),
        page.goto(runtime.origin).then((response) => { record("navigation", { path: response ? ownedPath(response.url()) : null, status: response?.status(), contentType: response?.headers()["content-type"] }); initialEvents.push({ event: "page-loaded", at: Date.now() }); }),
      ]);
      assert.equal(initialResponse.status(), 200);
      const initial = await initialResponse.json();
      assert.equal(initial.status, "signed-in");
      assert.deepEqual(initial.workspace.state.messages, old.state.messages);
      assert.equal(initial.workspace.pendingPreparedId, null);
      initialEvents.push({ event: "account-validated", at: Date.now() });
      await expect(page.getByText(historicalName, { exact: true }).first()).toBeVisible();
      await writeFile(`${directory}/${viewport.width}-initial.json`, JSON.stringify({ status: "passed", accountLatencyMs: viewport.width === 390 ? 5500 : 0, events: initialEvents }, null, 2) + "\n");
      await writeBootstrap("initial");
    } catch (error) {
      await writeBootstrap("initial");
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
    firstEvents.length = 0; lastEvents.length = 0; requests.clear(); pendingRules.clear();
    firstBytes = 0; lastBytes = 0; droppedEvents = 0; droppedRequests = 0; capturing = true;
    try {
      const [restoredResponse] = await Promise.all([
        page.waitForResponse((response) => response.url() === `${runtime.origin}/api/account` && response.request().method() === "GET"),
        page.reload().then((response) => { record("navigation", { path: response ? ownedPath(response.url()) : null, status: response?.status(), contentType: response?.headers()["content-type"] }); reloadEvents.push({ event: "page-loaded", at: Date.now() }); }),
      ]);
      assert.equal(restoredResponse.status(), 200);
      const restored = await restoredResponse.json();
      assert.equal(restored.status, "signed-in");
      assert.deepEqual(restored.workspace, saved.workspace);
      reloadEvents.push({ event: "account-validated", at: Date.now() });
      await expect(page.getByText("SGD 868.00", { exact: true })).toBeVisible();
      await writeFile(`${directory}/${viewport.width}-reload.json`, JSON.stringify({ status: "passed", accountLatencyMs: viewport.width === 390 ? 5500 : 0, events: reloadEvents }, null, 2) + "\n");
      await writeBootstrap("reload");
    } catch (error) {
      await writeBootstrap("reload");
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
