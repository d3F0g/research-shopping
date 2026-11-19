import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { offlineNetwork } from "../network";
import { scenarioMaterial } from "../inputs/materials";
import { materialPayloadHash } from "../hash";
import { stableComposerGeometry } from "./layout";
import type { Json } from "../contracts";

const { values } = parseArgs({ options: { out: { type: "string", default: "artifacts/product-evals/browser" }, mode: { type: "string", default: "report" } } });
if (!["report", "strict", "smoke"].includes(values.mode!)) throw new Error("Use --mode report, strict or smoke");
const output = resolve(values.out!);
await mkdir(output, { recursive: true });
const guard = offlineNetwork();
const proof = { schemaVersion: 1, feature: "normal-shopping-conversation", commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), worktreeStatus: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(), mode: values.mode, label: "Actual browser, Vite, Hono and Exa SDK HTTP with entirely synthetic fake-key loopback research. Zero Exa credits; no real shopping usefulness or merchant verification.", result: "failed", cleanup: false, interrupted: false, actions: [] as string[], checks: [] as { name: string; result: "pass" | "fail" | "unsupported"; expected: string; observed: Json }[], screenshots: [] as string[], traces: [] as string[], browserRequests: [] as Json[], browserResponses: [] as Json[], deniedBrowserRequests: [] as string[], pageErrors: [] as string[], providerEvents: [] as Json[], owned: {} as Record<string, Json> };
let browser: Browser | undefined;
let web: ReturnType<typeof spawn> | undefined;
let app: Awaited<ReturnType<typeof import("../adapter")["ownedApplication"]>> | undefined;
let serverLog = "";
const contexts: BrowserContext[] = [];
const pendingResponses: Promise<void>[] = [];
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => {
  proof.interrupted = true;
  if (browser) void browser.close().catch(() => undefined); else web?.kill(signal);
});
async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}
function checked(name: string, ok: boolean, expected: string, observed: Json) {
  proof.checks.push({ name, result: ok ? "pass" : "fail", expected, observed });
  if (!ok && values.mode === "smoke") throw new Error(`${name}: ${JSON.stringify(observed)}`);
}
let origin = "";
async function doctor() {
  const response = await fetch(`${origin}/api/health`);
  const health = await response.json() as { status: string; mode: string };
  if (!response.ok || health.status !== "ok" || health.mode !== "research") throw new Error("Owned application health did not establish normal research composition");
}
async function pageFor(name: string, viewport = { width: 1440, height: 1000 }) {
  await doctor();
  const context = await browser!.newContext({ viewport, colorScheme: "light", reducedMotion: "reduce", serviceWorkers: "block" });
  contexts.push(context);
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { proof.deniedBrowserRequests.push(`${url.origin}${url.pathname}`); await route.abort("blockedbyclient"); } else await route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on("pageerror", (error) => proof.pageErrors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/turn") proof.browserRequests.push({ journey: name, body: request.postDataJSON() as Json });
  });
  page.on("response", (response) => {
    if (new URL(response.url()).pathname === "/api/turn") pendingResponses.push((async () => { try { proof.browserResponses.push({ journey: name, status: response.status(), body: await response.json() as Json }); } catch { proof.browserResponses.push({ journey: name, status: response.status(), body: "Response body unavailable after observed cancellation" }); } })());
  });
  await page.goto(origin);
  await expect(page.getByLabel("Message", { exact: true })).toBeVisible();
  return page;
}
async function screenshot(page: Page, name: string) {
  const filename = `${name}.png`;
  const geometry = await stableComposerGeometry(page);
  await page.screenshot({ path: join(output, filename), animations: "disabled" });
  proof.screenshots.push(filename);
  checked(`screenshot-layout-stable:${name}`, geometry.stable, "Responsive composer reaches stable visible geometry within 2000 ms before capture", geometry);
}
async function send(page: Page, text: string, pending = false) {
  app!.setTurn(proof.browserRequests.length);
  await page.getByLabel("Message", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  if (!pending) {
    await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeVisible();
    await expect(page.locator('[data-testid="conversation-turn"]').last()).toHaveAttribute("data-active", "true");
    await Promise.all(pendingResponses);
  }
}
async function composerGeometry(page: Page) {
  const geometry = await stableComposerGeometry(page);
  if (!geometry.stable) {
    const filename = `unstable-composer-${proof.screenshots.length}.png`;
    await page.screenshot({ path: join(output, filename), animations: "disabled" });
    proof.screenshots.push(filename);
  }
  checked("composer-visible-no-horizontal-overflow", geometry.stable && geometry.fits, "Composer reaches stable visible geometry with no overflow within 2000 ms", geometry);
}
try {
  const webPort = await freePort();
  const input = scenarioMaterial("supported", "FN-RT-002");
  input.delayMs = 650;
  input.sha256 = materialPayloadHash(input);
  const { ownedApplication } = await import("../adapter");
  app = await ownedApplication(input, guard, { webPort });
  origin = `http://127.0.0.1:${webPort}`;
  guard.allow(origin);
  web = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--config", "evals/browser/vite.config.ts", "--host", "127.0.0.1", "--port", String(webPort), "--strictPort"], { cwd: process.cwd(), env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test", EXA_RESEARCH_ENABLED: "false", API_PORT: new URL(app.origin).port, VITE_API_PORT: new URL(app.origin).port, WEB_PORT: String(webPort) }, stdio: ["ignore", "pipe", "pipe"] });
  web.stdout!.on("data", (chunk) => { serverLog += String(chunk); });
  web.stderr!.on("data", (chunk) => { serverLog += String(chunk); });
  proof.owned = { webPid: web.pid ?? null, webOrigin: origin, apiOrigin: app.origin, providerLabel: input.label, materialHash: input.sha256 };
  const deadline = Date.now() + 20000;
  while (true) {
    try { await doctor(); break; } catch (error) { if (Date.now() >= deadline || web.exitCode !== null) throw error; await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  browser = await chromium.launch();
  const page = await pageFor("chat-and-theme");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByRole("complementary")).toHaveCount(0);
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.locator(".preferences-panel")).toHaveCount(0);
  await composerGeometry(page);
  await screenshot(page, "01-dark-empty-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await composerGeometry(page);
  await screenshot(page, "02-dark-empty-mobile");
  await page.getByRole("button", { name: "Switch to light mode", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/light/);
  await screenshot(page, "03-light-persisted-mobile");
  await page.getByRole("button", { name: "Switch to dark mode", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  proof.actions.push("Fresh profile began dark despite light OS preference. Actual theme toggle persisted light and dark after refresh.");
  const callsBefore = app.providerCalls;
  await send(page, "Hi");
  checked("ordinary-message-no-research", app.providerCalls === callsBefore && await page.getByRole("article").count() === 0, "Greeting remains an ordinary message and dispatches no research", { providerCalls: app.providerCalls - callsBefore });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await send(page, "Find three binocular options for birdwatching under USD 250", true);
  await expect(page.getByRole("button", { name: "Stop response", exact: true })).toBeVisible();
  await expect.poll(() => app!.providerCalls).toBe(callsBefore + 1);
  await screenshot(page, "04-actual-research-progress-desktop");
  checked("truthful-research-progress", app.events.some((event) => event.kind === "provider-request") && await page.getByRole("button", { name: "Stop response", exact: true }).isVisible(), "Pending UI corresponds to an observed real local SDK request", { providerCalls: app.providerCalls - callsBefore });
  await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: /Conditional choice/ })).toBeVisible();
  const active = page.getByTestId("conversation-turn").last();
  const firstCard = active.getByRole("article").first();
  await expect(firstCard).toContainText("Synthetic");
  await expect(firstCard).toContainText("Stock and delivery unverified");
  await firstCard.getByRole("button", { name: "Evidence and limits", exact: true }).click();
  await expect(firstCard.getByRole("blockquote").first()).toBeVisible();
  const link = firstCard.getByRole("link", { name: /View product source/ });
  await expect(link).toHaveAttribute("href", /https:\/\/fixture\.example\.com\//);
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await screenshot(page, "05-synthetic-recommendations-evidence-desktop");
  await page.setViewportSize({ width: 390, height: 600 });
  await firstCard.getByRole("button", { name: "Evidence and limits", exact: true }).click();
  await firstCard.scrollIntoViewIfNeeded();
  await composerGeometry(page);
  await screenshot(page, "06-synthetic-cards-mobile");
  await firstCard.getByRole("button", { name: "Evidence and limits", exact: true }).click();
  await firstCard.getByRole("blockquote").first().scrollIntoViewIfNeeded();
  await screenshot(page, "06b-synthetic-evidence-mobile");
  const history = page.getByLabel("Conversation history", { exact: true });
  await history.hover();
  await page.mouse.wheel(0, -10000);
  await composerGeometry(page);
  await screenshot(page, "07-history-composer-mobile");
  checked("retained-user-assistant-messages", await page.getByTestId("user-message").count() === 2 && await page.getByTestId("assistant-message").count() === 2, "Each actual user turn has one assistant message, and earlier history survives", { users: await page.getByTestId("user-message").count(), assistants: await page.getByTestId("assistant-message").count() });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await active.getByRole("button", { name: "Edit preferences", exact: true }).click();
  const maximum = page.getByLabel("Maximum budget amount", { exact: true });
  await expect(maximum).toHaveValue("250");
  await maximum.fill("220");
  const priorEditCalls = app.providerCalls;
  const editedResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/turn");
  await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  const edited = await (await editedResponse).json() as { preferences: { budget: { amount: number } } };
  await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeVisible();
  checked("contextual-edit-free", app.providerCalls === priorEditCalls && edited.preferences.budget.amount === 220, "Saving authoritative preferences updates the actual server budget without research", { additionalProviderCalls: app.providerCalls - priorEditCalls, actualMaximum: edited.preferences.budget.amount });
  await screenshot(page, "08-contextual-preference-edit-desktop");
  proof.actions.push("Actual normal app completed three synthetic product cards, source quotations and links, responsive scrolling and authoritative contextual budget editing.");
  const optional = await pageFor("optional-budget", { width: 390, height: 844 });
  await send(optional, "Find binoculars for birdwatching");
  await expect(optional.getByRole("button", { name: "Skip budget", exact: true })).toBeVisible();
  const skipCalls = app.providerCalls;
  await optional.getByRole("button", { name: "Skip budget", exact: true }).click();
  await expect(optional.getByRole("article")).toHaveCount(3);
  checked("optional-budget-skip", app.providerCalls === skipCalls + 1, "Actual skip continues to one local research request without inventing a budget", { additionalProviderCalls: app.providerCalls - skipCalls });
  await screenshot(optional, "09-optional-budget-skipped-mobile");
  proof.checks.push({ name: "trustworthy-product-images", result: "unsupported", expected: "Display images when trustworthy returned image URLs are supported", observed: "Inspected current product contract contains no image URL field. No image acceptance claimed." });
  if (values.mode !== "smoke") {
    const regression = await pageFor("powerbank-currency");
    await send(regression, "I want to buy a powerbank that costs around $30-40");
    await send(regression, "SGD");
    const responses = proof.browserResponses.filter((value) => typeof value === "object" && value !== null && !Array.isArray(value) && value.journey === "powerbank-currency") as Record<string, Json>[];
    const latest = responses.at(-1)?.body as Record<string, Json> | undefined;
    const prefs = latest?.preferences as Record<string, Json> | undefined;
    const budget = prefs?.budget as Record<string, Json> | null | undefined;
    checked("FN-CU-001-powerbank-currency", Boolean(budget?.currency === "SGD" && budget.minimum === 30 && budget.amount === 40 && latest?.kind === "research"), "Currency-only reply retains powerbank and SGD30-40, then researches without asking the amount again", { response: latest ?? null });
    await screenshot(regression, "10-powerbank-currency-desktop");
    await regression.setViewportSize({ width: 390, height: 600 });
    await composerGeometry(regression);
    await screenshot(regression, "11-powerbank-currency-mobile");
    const comparison = await pageFor("held-comparison");
    await send(comparison, "Find three binocular options for birdwatching under USD 250");
    const beforeComparison = app.providerCalls;
    await send(comparison, "Compare the first and third options");
    checked("held-comparison-no-research", app.providerCalls === beforeComparison, "Comparing held first and third options spends no additional research request", { additionalProviderCalls: app.providerCalls - beforeComparison });
    await screenshot(comparison, "12-held-comparison-desktop");
    const cancellation = await pageFor("cancellation", { width: 390, height: 600 });
    const beforeCancel = app.providerCalls;
    await send(cancellation, "Find binoculars under USD 250", true);
    await expect.poll(() => app!.providerCalls).toBe(beforeCancel + 1);
    await cancellation.getByRole("button", { name: "Stop response", exact: true }).click();
    await expect(cancellation.getByRole("button", { name: "Send message", exact: true })).toBeVisible();
    await new Promise((resolve) => setTimeout(resolve, 750));
    checked("cancel-reaches-provider-no-late-cards", app.events.some((event) => event.kind === "provider-aborted") && await cancellation.getByRole("article").count() === 0, "Stop aborts the actual SDK transport and no late product cards publish", { providerAborted: app.events.some((event) => event.kind === "provider-aborted"), cards: await cancellation.getByRole("article").count() });
    await screenshot(cancellation, "13-cancelled-mobile");
    const isolated = await pageFor("session-isolation");
    checked("session-isolation", await isolated.getByTestId("user-message").count() === 0 && await isolated.getByRole("article").count() === 0, "A separate context has no other conversation, products or preferences", { users: await isolated.getByTestId("user-message").count(), cards: await isolated.getByRole("article").count() });
    await screenshot(isolated, "14-isolated-session-desktop");
  }
  checked("no-unexpected-browser-network", proof.deniedBrowserRequests.length === 0 && proof.pageErrors.length === 0, "The browser makes no external request and reports no runtime errors", { denied: proof.deniedBrowserRequests, pageErrors: proof.pageErrors });
  proof.result = proof.checks.some((check) => check.result === "fail") ? "failed" : "passed";
} catch (error) {
  proof.checks.push({ name: "browser-infrastructure", result: "fail", expected: "Owned normal application journeys complete", observed: error instanceof Error ? error.stack ?? error.message : String(error) });
  for (const context of contexts) for (const page of context.pages()) { try { await screenshot(page, `failure-${proof.screenshots.length}`); } catch {} }
} finally {
  await Promise.allSettled(pendingResponses);
  for (const [index, context] of contexts.entries()) {
    const filename = `journey-${index + 1}.trace.zip`;
    try { await context.tracing.stop({ path: join(output, filename) }); proof.traces.push(filename); } catch { proof.actions.push(`Trace ${filename} could not finish after interruption.`); }
    await context.close().catch(() => undefined);
  }
  await browser?.close().catch(() => undefined);
  if (web && web.exitCode === null && web.signalCode === null) {
    const exited = once(web, "exit");
    web.kill("SIGTERM");
    await exited;
  }
  if (app) { proof.providerEvents = app.events as unknown as Json[]; await app.close(); }
  guard.close();
  proof.cleanup = true;
  await writeFile(join(output, "server.log"), serverLog);
  await writeFile(join(output, "proof.json"), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify({ result: proof.result, cleanup: proof.cleanup, artifact: join(output, "proof.json"), checks: proof.checks.map(({ name, result }) => ({ name, result })) }));
  if (proof.checks.some((check) => check.name === "browser-infrastructure") || values.mode !== "report" && proof.result !== "passed") process.exitCode = 1;
}
