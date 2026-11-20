import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium, expect, type Browser, type BrowserContext, type Page, type Locator } from "@playwright/test";
import { offlineNetwork } from "../network";
import { NativeAnswerSchema } from "../../src/server/exa-answer-v2";
import { currentScenarioMaterial } from "./materials";
import { materialPayloadHash } from "../hash";
import { stableComposerGeometry } from "../browser/layout";
import type { Json } from "../frozen-v4/contracts";
import type { TurnResponse } from "../../src/domain/conversation";

const { values } = parseArgs({ options: { out: { type: "string", default: "artifacts/product-evals/v2-browser" }, mode: { type: "string", default: "report" } }, strict: true });
if (!["report", "strict", "smoke"].includes(values.mode!)) throw new Error("Use --mode report, strict or smoke");
const output = resolve(values.out!);
await mkdir(output, { recursive: true });
const proof = { schemaVersion: 1, feature: "fieldnote-v2-normal-chat", commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), worktreeStatus: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(), label: "Actual V2 browser, Vite, Hono and Exa SDK with synthetic loopback research only. No interpreter, private environment, persistent ledger or paid traffic. Screenshots do not establish live product usefulness.", result: "failed", cleanup: false, checks: [] as { name: string; result: "pass" | "fail" | "unsupported"; observed: unknown }[], screenshots: [] as string[], traces: [] as string[], pageErrors: [] as string[], deniedRequests: [] as string[], providerEvents: [] as unknown[], limitations: ["Independent visual inspection of actual screenshots remains required.", "Semantic relevance, genuine Exa discovery and current merchant information are unassessed.", "The original historical browser runner and its artifacts remain preserved. These journeys use V2 public HTTP and UI contracts."] };
const guard = offlineNetwork();
let browser: Browser | undefined;
let web: ReturnType<typeof spawn> | undefined;
let app: Awaited<ReturnType<typeof import("./adapter")["ownedApplication"]>> | undefined;
const contexts: BrowserContext[] = [];
const syntheticImages = new Map([
  ["https://fixture.example.com/images/synthetic-fieldglass.svg", { status: 200, body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="#444"/><text x="12" y="80" fill="white">Synthetic image fixture</text></svg>' }],
  ["https://fixture.example.com/images/synthetic-broken.svg", { status: 404, body: "Synthetic missing-image fixture" }],
]);
let serverLog = "";
let turn = 0;
async function freePort() {
  const server = createServer(); server.listen(0, "127.0.0.1"); await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  await new Promise<void>((resolve) => server.close(() => resolve())); return port;
}
function checked(name: string, ok: boolean, observed: unknown) {
  proof.checks.push({ name, result: ok ? "pass" : "fail", observed });
  if (!ok && values.mode === "smoke") throw new Error(`${name}: ${JSON.stringify(observed)}`);
}
async function screenshot(page: Page, name: string, subject?: Locator) {
  if (subject) {
    await expect.poll(async () => {
      await subject.evaluate((element) => {
        const viewport = element.closest('[data-slot="message-scroller-viewport"]');
        if (!viewport) throw new Error("Screenshot subject has no conversation viewport");
        viewport.scrollTo({ top: viewport.scrollTop + element.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 12, behavior: "instant" });
      });
      await page.waitForTimeout(100);
      const box = await subject.boundingBox(), composer = await page.getByLabel("Message", { exact: true }).boundingBox();
      return Boolean(box && composer && box.y >= 50 && box.y + Math.min(box.height, 100) < composer.y);
    }, { timeout: 3000 }).toBe(true);
    checked(`screenshot-subject-visible:${name}`, true, "Named subject is within the conversation viewport above the composer");
  }
  const geometry = await stableComposerGeometry(page);
  checked(`composer-visible:${name}`, geometry.stable && geometry.fits, geometry);
  await page.screenshot({ path: join(output, `${name}.png`), animations: "disabled" });
  proof.screenshots.push(`${name}.png`);
}
async function settledTurn(page: Page, originatingTurn: number) {
  let response: TurnResponse | undefined;
  await expect.poll(() => {
    response = app!.events.filter((event) => event.kind === "app-response" && event.turn === originatingTurn)
      .map((event) => (event.body as { body?: TurnResponse }).body)
      .find((body) => body?.kind && body.kind !== "prepared");
    return Boolean(response);
  }, { timeout: 10000 }).toBe(true);
  await expect(page.getByRole("button", { name: "Stop research", exact: true })).toHaveCount(0);
  const message = response!.state.messages.at(-1);
  if (!message) throw new Error("The completed originating turn has no visible message");
  await expect(page.getByText(message.text, { exact: true }).last()).toBeVisible();
}
async function send(page: Page, text: string, pending = false) {
  const originatingTurn = ++turn;
  await page.evaluate((value) => { (globalThis as typeof globalThis & { evaluationTurn: number }).evaluationTurn = value; }, originatingTurn);
  await page.getByLabel("Message", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  if (!pending) await settledTurn(page, originatingTurn);
  return originatingTurn;
}
async function initialResultGeometry(page: Page, name: string) {
  const title = await page.locator('[data-slot="card-title"]').first().boundingBox();
  const viewport = await page.locator('[data-slot="message-scroller-viewport"]').boundingBox();
  const composer = await page.getByLabel("Message", { exact: true }).boundingBox();
  checked(`initial-result-start-readable:${name}`, Boolean(title && viewport && composer && title.y >= viewport.y && title.y + title.height < composer.y), { title, viewport, composer });
  await screenshot(page, name);
}
async function journey(name: string, body: () => Promise<void>) {
  try { await body(); }
  catch (error) { checked(name, false, error instanceof Error ? error.message : String(error)); }
}
try {
  const webPort = await freePort();
  const input = currentScenarioMaterial("supported", "FN-RT-002");
  const fixtureProductName = NativeAnswerSchema.parse((input.body as Record<string, Json>).answer).products[0]!.name;
  input.delayMs = 700;
  const citations = (input.body as Record<string, Json>).citations as Record<string, Json>[];
  citations[0]!.image = [...syntheticImages.keys()][0]!;
  citations[1]!.image = [...syntheticImages.keys()][1]!;
  input.provenance.push("Browser-only fixed delay and explicitly synthetic citation-image metadata. Original native1 materials remain unchanged; this is the separate labeled V5 test composition.");
  input.sha256 = materialPayloadHash(input);
  const { ownedApplication } = await import("./adapter");
  app = await ownedApplication(input, guard, { webPort });
  const origin = `http://127.0.0.1:${webPort}`;
  guard.allow(origin);
  web = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--config", "evals/browser/vite.config.ts", "--host", "127.0.0.1", "--port", String(webPort), "--strictPort"], { env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test", EXA_RESEARCH_ENABLED: "false", API_PORT: new URL(app.origin).port, VITE_API_PORT: new URL(app.origin).port, WEB_PORT: String(webPort) }, stdio: ["ignore", "pipe", "pipe"] });
  web.stdout!.on("data", (chunk) => { serverLog += String(chunk); }); web.stderr!.on("data", (chunk) => { serverLog += String(chunk); });
  const deadline = Date.now() + 20000;
  while (true) {
      try { const response = await fetch(`${origin}/api/health`); if (response.ok) break; } catch {}
    if (Date.now() >= deadline || web.exitCode !== null) throw new Error("Owned browser application did not start");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch();
  async function pageFor(name: string) {
    const context = await browser!.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "light" });
    contexts.push(context);
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    const page = await context.newPage();
    page.on("pageerror", (error) => proof.pageErrors.push(error.message));
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      const syntheticImage = syntheticImages.get(url.href);
      if (syntheticImage) { await route.fulfill({ ...syntheticImage, contentType: "image/svg+xml" }); return; }
      if (url.origin !== origin) { proof.deniedRequests.push(`${url.origin}${url.pathname}`); await route.abort(); return; }
      if (url.pathname.startsWith("/api/") && url.pathname !== "/api/health") {
        const index = await page.evaluate(() => (globalThis as typeof globalThis & { evaluationTurn?: number }).evaluationTurn ?? 0).catch(() => 0);
        await route.continue({ headers: { ...route.request().headers(), ...app!.requestHeaders(index) } });
      } else await route.continue();
    });
    await page.goto(origin); await expect(page.getByLabel("Message", { exact: true })).toBeVisible();
    return { page, finish: async () => { const trace = `${name}.trace.zip`; await context.tracing.stop({ path: join(output, trace) }); proof.traces.push(trace); } };
  }
  const main = await pageFor("chat-theme-research");
  await journey("empty-theme-and-ordinary-message", async () => {
    const page = main.page;
    await expect(page.locator("html")).toHaveClass(/dark/);
    checked("minimal-empty-chat", await page.getByRole("complementary").count() === 0 && await page.locator('[data-slot="card"]').count() === 0, { sidebars: await page.getByRole("complementary").count(), cards: await page.locator('[data-slot="card"]').count() });
    await screenshot(page, "01-dark-empty-desktop");
    await page.setViewportSize({ width: 390, height: 844 }); await screenshot(page, "02-dark-empty-mobile");
    await page.getByRole("button", { name: "Switch to light mode", exact: true }).click(); await page.reload();
    await expect(page.locator("html")).toHaveClass(/light/); await screenshot(page, "03-light-persisted-mobile");
    await page.getByRole("button", { name: "Switch to dark mode", exact: true }).click(); await page.reload(); await expect(page.locator("html")).toHaveClass(/dark/);
    const before = app!.providerCalls; await send(page, "Hi");
    checked("ordinary-message-no-dispatch", app!.providerCalls === before, { calls: app!.providerCalls - before });
  });
  await journey("research-evidence-and-held-comparison", async () => {
    const page = main.page; await page.setViewportSize({ width: 1440, height: 1000 });
    const before = app!.providerCalls; const researchTurn = await send(page, "Find binoculars for birdwatching under USD 250", true);
    await expect.poll(() => app!.providerCalls).toBe(before + 1);
    await expect(page.getByRole("button", { name: "Stop research", exact: true })).toBeVisible();
    await screenshot(page, "04-actual-research-progress-desktop");
    await settledTurn(page, researchTurn);
    checked("actual-products-rendered", await page.locator('[data-slot="card-title"]').count() > 0, { products: await page.locator('[data-slot="card-title"]').count() });
    await initialResultGeometry(page, "05a-initial-result-scroll-desktop");
    await screenshot(page, "05-synthetic-cards-desktop", page.locator('[data-slot="card"]').first());
    const disclosures = page.getByRole("button", { name: /evidence|sources/i });
    if (await disclosures.count()) { await disclosures.first().click(); await screenshot(page, "06-source-disclosure-desktop", page.locator("blockquote").first()); await disclosures.first().click(); }
    else checked("evidence-disclosure-available", false, "No source or evidence disclosure button found");
    await page.setViewportSize({ width: 390, height: 844 }); await screenshot(page, "07-cards-mobile", page.locator('[data-slot="card"]').first());
    const held = app!.providerCalls; await send(page, "Compare the first two"); await send(page, "Keep it short");
    checked("held-comparison-and-presentation-free", app!.providerCalls === held, { calls: app!.providerCalls - held });
    await screenshot(page, "08-history-composer-mobile");
  });
  await main.finish();
  const currency = await pageFor("powerbank-currency");
  await journey("currency-range-and-automatic-research", async () => {
    const page = currency.page, before = app!.providerCalls;
    await send(page, "I want to buy a powerbank around $30-40.");
    checked("currency-clarification-before-dispatch", app!.providerCalls === before, { calls: app!.providerCalls - before });
    await screenshot(page, "09-powerbank-currency-desktop");
    await page.setViewportSize({ width: 390, height: 844 }); await screenshot(page, "10-powerbank-pending-mobile");
    await send(page, "SGD");
    const response = app!.events.filter((event) => event.kind === "app-response" && event.turn === turn).at(-1)?.body as { body?: { state?: { intent?: { budget?: { minimum?: number; maximum?: number; currency?: string }; productDescription?: string } } } } | undefined;
    const budget = response?.body?.state?.intent?.budget;
    checked("currency-answer-resumes-with-both-bounds", app!.providerCalls === before + 1 && budget?.minimum === 30 && budget.maximum === 40 && budget.currency === "SGD", { calls: app!.providerCalls - before, intent: response?.body?.state?.intent });
    await initialResultGeometry(page, "11a-initial-result-scroll-mobile");
    await screenshot(page, "11-powerbank-resumed-mobile", page.locator('[data-slot="card"]').first());
  });
  await currency.finish();
  const cancellation = await pageFor("cancellation-reset-isolation");
  await journey("cancellation-reset-and-session-isolation", async () => {
    const page = cancellation.page; await page.setViewportSize({ width: 390, height: 844 });
    const before = app!.providerCalls; await send(page, "Find binoculars under USD 250", true);
    await expect.poll(() => app!.providerCalls).toBe(before + 1);
    await page.getByRole("button", { name: "Stop research", exact: true }).click();
    await expect.poll(() => app!.events.some((event) => event.kind === "provider-aborted" && event.turn === turn)).toBe(true);
    await screenshot(page, "12-cancelled-mobile");
    await page.getByRole("button", { name: "New chat", exact: true }).click(); await expect(page.locator('[data-slot="card-title"]')).toHaveCount(0);
    const isolated = await pageFor("isolated-session");
    await expect(isolated.page.locator('[data-slot="card-title"]')).toHaveCount(0);
    checked("isolated-cookie-session-empty", !(await isolated.page.locator("body").innerText()).includes(fixtureProductName), "Independent browser profile retains no previous recommendation");
    await screenshot(isolated.page, "13-isolated-session-desktop"); await isolated.finish();
  });
  await cancellation.finish();
  proof.providerEvents = structuredClone(app.events);
  checked("no-browser-runtime-errors", proof.pageErrors.length === 0, proof.pageErrors);
  proof.result = proof.checks.some((check) => check.result === "fail") ? "failed" : "passed";
} catch (error) { proof.checks.push({ name: "browser-execution", result: "fail", observed: error instanceof Error ? error.stack : String(error) }); }
finally {
  await Promise.allSettled(contexts.map((context) => context.close()));
  await browser?.close();
  if (web && web.exitCode === null) { web.kill("SIGTERM"); await once(web, "exit"); }
  if (app) { proof.providerEvents = structuredClone(app.events); await app.close(); }
  guard.close(); proof.cleanup = true;
  await writeFile(join(output, "server.log"), serverLog);
  await writeFile(join(output, "proof.json"), JSON.stringify(proof, null, 2));
}
console.log(JSON.stringify({ artifact: join(output, "proof.json"), result: proof.result, screenshots: proof.screenshots.length, failures: proof.checks.filter((check) => check.result === "fail") }));
if (proof.result !== "passed" && values.mode !== "report") process.exitCode = 1;
