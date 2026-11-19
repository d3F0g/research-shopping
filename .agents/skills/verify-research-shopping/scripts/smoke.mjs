#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 2 && args[0] === '--project-dir'), 'Use smoke.mjs [--project-dir /checkout]');
const repo = args.length ? path.resolve(args[1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const git = (...arguments_) => execFileSync('git', arguments_, { cwd: repo, encoding: 'utf8' }).trim();
const sourceState = () => ({
  status: git('status', '--porcelain', '--untracked-files=all', '--', '.', ':(exclude)artifacts/**'),
  diffSha256: createHash('sha256').update(git('diff', '--binary', 'HEAD', '--', '.', ':(exclude)artifacts/**')).digest('hex'),
});
const run = {
  repo,
  apiPort: Number(process.env.VERIFY_API_PORT ?? 3173),
  webPort: Number(process.env.VERIFY_WEB_PORT ?? 5283),
  artifacts: path.resolve(process.env.VERIFY_ARTIFACT_DIR ?? path.join(repo, 'artifacts/fieldnote-v2/verification-skill', new Date().toISOString().replaceAll(':', '-'))),
  commit: git('rev-parse', 'HEAD'),
  worktreeStatus: git('status', '--porcelain'),
  sourceState: sourceState(),
};
for (const port of [run.apiPort, run.webPort]) assert(Number.isInteger(port) && port > 0 && port <= 65535, 'Ports must be integers between 1 and 65535');
assert.notEqual(run.apiPort, run.webPort, 'Use distinct ports');
const { chromium, expect } = createRequire(path.join(repo, 'package.json'))('@playwright/test');
await mkdir(run.artifacts, { recursive: true });
const proof = {
  ...run,
  composition: 'Automated test only. Actual Hono + Exa SDK against owned loopback substitute.',
  result: 'failed', cleanup: false, processes: [], journeys: [],
  limits: ['No live Exa retrieval, billing, merchant reachability, inventory, semantic factuality, or PostgreSQL/account acceptance.', 'Cancellation at the browser transport boundary does not establish SDK socket cancellation. Run the package API tests.', 'Screenshots require independent visual inspection. This helper does not approve the final V2 PR.'],
};
const log = createWriteStream(path.join(run.artifacts, 'server.log'));
const servers = [];
let browser;
let context;
let page;
let failed;
const baseURL = `http://127.0.0.1:${run.webPort}`;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function portIsFree(port) {
  await new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.once('error', reject);
    listener.listen(port, '127.0.0.1', () => listener.close(resolve));
  });
}
function start(name, arguments_, env) {
  const child = spawn(process.execPath, arguments_, { cwd: repo, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env });
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  const owned = { child, closed: new Promise((resolve) => child.once('close', resolve)) };
  servers.push(owned);
  proof.processes.push({ name, pid: child.pid });
  child.once('error', (error) => { failed = error; });
}
async function stats() {
  const response = await fetch(`${baseURL}/api/test-stats`, { signal: AbortSignal.timeout(1500) });
  assert.equal(response.status, 200);
  const value = await response.json();
  assert(Number.isInteger(value.calls));
  return value.calls;
}
async function settle() {
  await page.evaluate(() => new Promise((resolve) => {
    let frames = 0;
    const tick = () => { if (++frames >= 30) resolve(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }));
}
async function screenshot(name) {
  await settle();
  await page.screenshot({ path: path.join(run.artifacts, `${name}.png`) });
}
async function geometry(locator) {
  return locator.evaluate((element) => {
    const r = element.getBoundingClientRect();
    const scroller = element.closest('[data-slot="message-scroller-viewport"]')?.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight, clipTop: scroller?.top ?? 0, clipBottom: scroller?.bottom ?? innerHeight };
  });
}
async function insideViewport(locator, label) {
  const box = await geometry(locator);
  assert(box.width > 0 && box.height > 0 && box.x >= -1 && box.right <= box.viewportWidth + 1 && box.y >= Math.max(0, box.clipTop) - 1 && box.bottom <= Math.min(box.viewportHeight, box.clipBottom) + 1, `${label} is clipped or outside the visible viewport: ${JSON.stringify(box)}`);
  return box;
}
async function unobscuredControl(locator, label) {
  const check = await locator.evaluate((element) => {
    const r = element.getBoundingClientRect();
    const viewport = element.closest('[data-slot="message-scroller-viewport"]')?.getBoundingClientRect();
    const visible = { left: Math.max(0, r.left), top: Math.max(0, viewport?.top ?? 0, r.top), right: Math.min(innerWidth, r.right), bottom: Math.min(innerHeight, viewport?.bottom ?? innerHeight, r.bottom) };
    const floating = [...document.querySelectorAll('[data-slot="message-scroller-button"]')].filter((button) => {
      const style = getComputedStyle(button);
      return style.pointerEvents !== 'none' && Number(style.opacity) > 0 && button.getAttribute('data-active') !== 'false';
    }).map((button) => {
      const b = button.getBoundingClientRect();
      const width = Math.max(0, Math.min(visible.right, b.right) - Math.max(visible.left, b.left));
      const height = Math.max(0, Math.min(visible.bottom, b.bottom) - Math.max(visible.top, b.top));
      return { name: button.textContent?.trim(), rect: { x: b.x, y: b.y, width: b.width, height: b.height }, intersection: { width, height, area: width * height } };
    });
    const hits = [];
    if (visible.right > visible.left + 12 && visible.bottom > visible.top + 12) {
      for (const x of [visible.left + 6, (visible.left + visible.right) / 2, visible.right - 6]) for (const y of [visible.top + 6, (visible.top + visible.bottom) / 2, visible.bottom - 6]) {
        const hit = document.elementFromPoint(x, y);
        hits.push({ x, y, targetReached: Boolean(hit && (hit === element || element.contains(hit))), hit: hit?.tagName, slot: hit?.closest('[data-slot]')?.getAttribute('data-slot') });
      }
    }
    return { rect: { x: r.x, y: r.y, width: r.width, height: r.height }, visible, floating, hits };
  });
  proof.controlChecks ??= [];
  proof.controlChecks.push({ label, viewport: page.viewportSize(), ...check });
  assert(check.floating.every((button) => button.intersection.area <= 0.5), `${label} overlaps a floating scroll control: ${JSON.stringify(check)}`);
  assert(check.hits.every((hit) => hit.targetReached), `${label} is obscured at a visible hit-test point: ${JSON.stringify(check)}`);
  return check;
}
async function composerVisible() {
  const composer = page.getByRole('textbox', { name: 'Message', exact: true });
  const textbox = await insideViewport(composer, 'Composer');
  const send = await insideViewport(page.getByRole('button', { name: 'Send message', exact: true }), 'Send action');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Document has horizontal overflow');
  return { textbox, send };
}
const phaseResponse = (phase) => page.waitForResponse((response) => {
  const request = response.request();
  return new URL(response.url()).pathname === '/api/turn' && request.method() === 'POST' && request.postDataJSON()?.phase === phase;
});
async function send(message, action) {
  const preparedResponse = phaseResponse('prepare');
  if (action) await action();
  else {
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill(message);
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
  }
  const response = await preparedResponse;
  assert.equal(response.status(), 200);
  const prepared = await response.json();
  let final = prepared;
  if (prepared.kind === 'prepared') {
    await expect.poll(async () => {
      const value = await page.request.get('/api/session').then((r) => r.json());
      return value.state.messages.some((m) => m.id === `${response.request().postDataJSON().operationId}-research`) || value.state.messages.at(-1)?.text?.includes('No automatic retry');
    }).toBe(true);
    await expect(page.getByRole('status')).toHaveCount(0);
    const state = await page.request.get('/api/session').then((r) => r.json());
    const last = state.state.messages.at(-1);
    final = { state: state.state, ...(last?.research ? { kind: 'research', research: last.research } : { kind: 'research-unavailable', message: last?.text }) };
  }
  await expect(page.getByRole('status')).toHaveCount(0);
  return { prepared, final };
}
async function reset() {
  await page.getByRole('button', { name: 'New chat', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What are you looking for?', exact: true })).toBeVisible();
}
async function newContext(viewport) {
  context = await browser.newContext({ baseURL, viewport: { width: viewport.width, height: viewport.height }, colorScheme: 'light', reducedMotion: 'reduce' });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  page = await context.newPage();
  const errors = [];
  const external = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === baseURL) return route.continue();
    if (/^https:\/\/manufacturer\.com\/model-[abc]\.png$/.test(url.href)) {
      if (viewport.name === 'short-mobile') return route.abort('failed');
      return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="100"><rect x="55" y="10" width="70" height="80" rx="8" fill="#777"/><text x="90" y="55" text-anchor="middle" fill="white">Fixture</text></svg>' });
    }
    external.push(`${route.request().method()} ${url.origin}${url.pathname}`);
    return route.abort('blockedbyclient');
  });
  return { errors, external };
}

try {
  await portIsFree(run.apiPort);
  await portIsFree(run.webPort);
  const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'TZ', 'SYSTEMROOT', 'WINDIR'].filter((name) => process.env[name] !== undefined).map((name) => [name, process.env[name]]));
  Object.assign(env, { NODE_ENV: 'test', EXA_RESEARCH_ENABLED: 'false', API_PORT: String(run.apiPort), VITE_API_PORT: String(run.apiPort), WEB_PORT: String(run.webPort) });
  proof.environment = { inherited: Object.keys(env).sort(), privateProviderAndDatabaseVariables: 'not inherited', environmentFiles: 'not loaded' };
  start('test-api', ['--import', 'tsx', 'tests/helpers/browser-server.ts'], env);
  start('vite', ['--input-type=module', '-e', "import { createServer } from 'vite'; const server = await createServer({ envFile: false }); await server.listen();"], env);
  const deadline = Date.now() + 60_000;
  while (true) {
    if (failed) throw failed;
    for (const { child } of servers) assert.equal(child.exitCode, null, 'Owned server exited before readiness');
    try {
      const response = await fetch(`${baseURL}/api/health`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) {
        const health = await response.json();
        assert.equal(health.status, 'ok'); assert.equal(health.provider, 'exa'); assert.equal(health.automaticPaidChecks, false);
        await stats();
        proof.health = health;
        break;
      }
    } catch (error) { if (Date.now() >= deadline) throw error; }
    assert(Date.now() < deadline, 'Owned app readiness timed out');
    await delay(200);
  }
  browser = await chromium.launch();
  for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }, { name: 'short-mobile', width: 390, height: 600 }]) {
    const journey = { viewport, result: 'failed', checks: [] };
    proof.journeys.push(journey);
    const { errors, external } = await newContext(viewport);
    await page.goto(baseURL);
    await expect(page.getByRole('heading', { name: 'What are you looking for?', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveClass('dark');
    assert.equal(await page.getByRole('button', { name: 'Current request and preferences', exact: true }).count(), 0);
    assert(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight), 'Empty state must fit without introductory scrolling');
    journey.composer = await composerVisible();
    await screenshot(`${viewport.name}-01-dark-empty`);
    await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click(); await page.reload();
    await expect(page.locator('html')).toHaveClass('light');
    await screenshot(`${viewport.name}-02-light-empty`);
    await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click(); await page.reload();
    await expect(page.locator('html')).toHaveClass('dark');
    journey.checks.push('Fresh OS-light context defaults dark; light and dark selections survive refresh.');
    const beforeGreeting = await stats();
    const greeting = await send('hello');
    assert.equal(greeting.final.kind, 'message'); assert.equal(greeting.final.state.intent.budget, null); assert.equal(await stats(), beforeGreeting);
    await expect(page.getByText('Hi. What are you looking to buy?', { exact: true })).toBeVisible();
    await screenshot(`${viewport.name}-03-ordinary`);
    await reset();
    const before = await stats();
    const request = 'I want to buy a powerbank around $30-40.';
    const question = await send(request);
    assert.equal(question.final.kind, 'clarification'); assert.equal(question.final.state.pending.kind, 'currency');
    assert.equal(question.final.state.pending.originalRequest, request);
    assert.equal(question.final.state.pending.minimum, 30); assert.equal(question.final.state.pending.maximum, 40); assert.equal(await stats(), before);
    await screenshot(`${viewport.name}-04-currency-question`);
    const resolved = await send('SGD.');
    assert.equal(resolved.final.kind, 'research'); assert.deepEqual(resolved.final.state.intent.budget, { minimum: 30, maximum: 40, currency: 'SGD' });
    assert.equal(resolved.final.state.intent.originalText, request); assert.equal(resolved.final.state.pending, null);
    assert.equal(await stats(), before + 1, 'Currency resolution must automatically dispatch exactly one local substitute call');
    assert.equal(resolved.final.research.dataKind, 'test-fixture'); assert(resolved.final.research.choice);
    journey.currencyResolution = { originalRequest: resolved.final.state.intent.originalText, pendingMinimum: question.final.state.pending.minimum, pendingMaximum: question.final.state.pending.maximum, acceptedBudget: resolved.final.state.intent.budget, localCallsBefore: before, localCallsAfter: await stats(), dataKind: resolved.final.research.dataKind, choice: resolved.final.research.choice };
    const answer = page.getByText(resolved.final.research.summary, { exact: true }).last();
    const title = page.getByText('Fixture Powerbank Model A', { exact: true }).last();
    await expect(title).toBeVisible();
    await screenshot(`${viewport.name}-05-research-initial`);
    journey.initialSourceControl = await unobscuredControl(page.locator('a').filter({ hasText: /^View product source/ }).first(), 'Initial source link');
    journey.initialGeometry = { answer: await insideViewport(answer, 'Leading recommendation'), title: await insideViewport(title, 'First product name'), composer: await composerVisible() };
    await expect(page.getByText('Fixture data. Automated test substitute.', { exact: true })).toBeVisible();
    await expect(page.getByText('SGD 30–40', { exact: true })).toBeVisible();
    const image = page.getByRole('img', { name: 'Source illustration for Fixture Powerbank Model A', exact: true });
    if (viewport.name === 'short-mobile') {
      await expect(image).toHaveCount(0);
      journey.checks.push('Failed source illustration is removed; product, evidence and source link remain.');
    } else {
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0)).toBe(true);
    }
    journey.checks.push('Typed currency preserves request and both bounds, automatically researches once, labels fixture evidence and places the leading recommendation inside the viewport before manual scrolling.');
    const evidence = page.getByRole('button', { name: 'Evidence and tradeoffs for Fixture Powerbank Model A', exact: true }).last();
    await evidence.scrollIntoViewIfNeeded(); await evidence.click();
    await expect(page.locator('blockquote').first()).toContainText('Fixture data:');
    const source = page.locator('a').filter({ hasText: /^View product source/ }).first();
    const href = await source.getAttribute('href');
    assert.equal(href, resolved.final.research.sources.find((s) => s.url === href)?.url);
    journey.sourceLink = href;
    const destination = new URL(href); assert.equal(destination.protocol, 'https:'); assert.equal(destination.username + destination.password + destination.port, '');
    assert.equal(await source.getAttribute('target'), '_blank');
    const rel = (await source.getAttribute('rel') ?? '').split(/\s+/); assert(rel.includes('noopener') && rel.includes('noreferrer'));
    await source.scrollIntoViewIfNeeded(); await settle();
    await insideViewport(source, 'Scrolled source link'); await unobscuredControl(source, 'Scrolled source link');
    await page.locator('blockquote').first().scrollIntoViewIfNeeded(); await screenshot(`${viewport.name}-06-evidence`);
    await composerVisible();
    const heldCalls = await stats();
    const comparison = await send('Compare the first two.');
    assert.equal(comparison.final.kind, 'message'); assert.equal(await stats(), heldCalls, 'Held comparison must spend no provider call');
    await expect(page.getByText(comparison.final.message, { exact: true })).toBeVisible();
    assert(resolved.final.state.messages.every((old) => comparison.final.state.messages.some((current) => JSON.stringify(current) === JSON.stringify(old))), 'Earlier messages and research snapshots must remain unchanged');
    await screenshot(`${viewport.name}-07-comparison`);
    await page.getByRole('button', { name: 'Current request and preferences', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Shopping objective', exact: true })).toHaveValue(request);
    await expect(page.getByRole('spinbutton', { name: 'Minimum', exact: true })).toHaveValue('30');
    await expect(page.getByRole('spinbutton', { name: 'Maximum', exact: true })).toHaveValue('40');
    await expect(page.getByRole('textbox', { name: 'Currency', exact: true })).toHaveValue('SGD');
    await page.getByRole('spinbutton', { name: 'Maximum', exact: true }).fill('50');
    await page.getByRole('button', { name: 'Apply and research', exact: true }).scrollIntoViewIfNeeded();
    await screenshot(`${viewport.name}-08-preferences`);
    await insideViewport(page.getByRole('button', { name: 'Apply and research', exact: true }), 'Apply preferences');
    await unobscuredControl(page.getByRole('button', { name: 'Apply and research', exact: true }), 'Apply preferences');
    const edited = await send('', () => page.getByRole('button', { name: 'Apply and research', exact: true }).click());
    assert.equal(edited.final.kind, 'research'); assert.deepEqual(edited.final.state.intent.budget, { minimum: 30, maximum: 50, currency: 'SGD' });
    assert.equal(await stats(), heldCalls + 1);
    journey.preferenceEdit = { acceptedBudget: edited.final.state.intent.budget, heldComparisonCallsBefore: heldCalls, callsAfterHeldComparison: heldCalls, callsAfterEdit: await stats(), retainedMessages: comparison.final.state.messages.length };
    assert(resolved.final.state.messages.every((old) => edited.final.state.messages.some((current) => JSON.stringify(current) === JSON.stringify(old))), 'Editing preferences must preserve historical snapshots');
    journey.checks.push('Evidence exposes literal fixture quotation and a safe retained source link; held comparison uses zero provider calls; contextual editor updates maximum to 50 while retaining minimum 30, SGD and historical messages.');
    const history = page.locator('[data-slot="message-scroller-viewport"]');
    await history.hover(); await page.mouse.wheel(0, -100000); await settle();
    await expect.poll(() => history.evaluate((element) => element.scrollTop)).toBeLessThanOrEqual(1);
    const topComposer = await composerVisible();
    await screenshot(`${viewport.name}-09-history-top`);
    await history.hover(); await page.mouse.wheel(0, 100000); await settle();
    const bottomComposer = await composerVisible();
    assert(Math.abs(topComposer.textbox.y - bottomComposer.textbox.y) <= 1, 'Composer must remain anchored while history scrolls');
    await screenshot(`${viewport.name}-10-history-bottom`);
    await reset();
    const unavailable = await send('I want a provider error powerbank under SGD 40');
    assert.equal(unavailable.final.kind, 'research-unavailable');
    assert.equal(unavailable.final.state.intent.budget.maximum, 40);
    assert(unavailable.final.state.messages.some((m) => m.role === 'user' && m.text.includes('provider error')));
    assert.equal(await page.getByText('Fixture data. Automated test substitute.', { exact: true }).count(), 0, 'Provider errors must not select fixtures');
    await expect(page.getByText(unavailable.final.message, { exact: true })).toBeVisible();
    await screenshot(`${viewport.name}-11-provider-error`);
    await reset();
    const cancellationCalls = await stats();
    let release;
    let reached;
    const held = new Promise((resolve) => { release = resolve; });
    const intercepted = new Promise((resolve) => { reached = resolve; });
    const routeHandler = async (route) => {
      if (route.request().postDataJSON()?.phase !== 'research') return route.continue();
      reached(); await held;
      try { await route.continue(); } catch (error) { if (!/closed|cancel|abort/i.test(error.message)) throw error; }
    };
    await page.route('**/api/turn', routeHandler);
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill('I want a powerbank under SGD 40');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await Promise.race([intercepted, delay(6000).then(() => { throw new Error('Research phase was not reached'); })]);
    await expect(page.getByRole('button', { name: 'Stop research', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Stop research', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Stop research', exact: true })).toHaveCount(0);
    await reset(); release(); await settle();
    await page.unroute('**/api/turn', routeHandler);
    const clean = await page.request.get('/api/session').then((r) => r.json());
    assert.equal(clean.state.messages.length, 0); assert.equal(clean.state.intent.budget, null); assert.equal(await stats(), cancellationCalls);
    await expect(page.getByRole('heading', { name: 'What are you looking for?', exact: true })).toBeVisible();
    await screenshot(`${viewport.name}-12-cancelled-new-chat`);
    journey.checks.push('Provider failure retains the request without fixture fallback; Stop then New chat prevents a held browser research request from dispatching or publishing late results.');
    const isolated = await browser.newContext();
    try {
      const other = await isolated.request.get(`${baseURL}/api/session`).then((r) => r.json());
      assert.equal(other.state.messages.length, 0); assert.equal(other.state.intent.budget, null);
      await send('hello');
      const unchanged = await isolated.request.get(`${baseURL}/api/session`).then((r) => r.json());
      assert.deepEqual(unchanged.state, other.state, 'Another browser context must not see this conversation');
    } finally { await isolated.close(); }
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    journey.checks.push('Separate browser context does not inherit or observe another session.');
    journey.result = 'passed';
    await context.tracing.stop({ path: path.join(run.artifacts, `${viewport.name}-trace.zip`) });
    await context.close(); context = null; page = null;
  }
  proof.commitAfter = git('rev-parse', 'HEAD'); proof.worktreeStatusAfter = git('status', '--porcelain'); proof.sourceStateAfter = sourceState();
  assert.equal(proof.commitAfter, run.commit, 'Candidate commit changed during verification');
  assert.deepEqual(proof.sourceStateAfter, run.sourceState, 'Source working tree changed during verification');
  proof.cleanCandidate = run.sourceState.status === '';
  proof.acceptance = proof.cleanCandidate ? 'Offline browser subset passed. Independent visual and product reviews remain required.' : 'Diagnostic only. Dirty application source is not commit acceptance.';
  proof.result = 'passed';
} catch (error) {
  proof.error = error.stack ?? String(error);
  if (page) {
    try {
      await page.screenshot({ path: path.join(run.artifacts, 'failure.png') });
      proof.failureState = await page.evaluate(() => {
        const viewport = document.querySelector('[data-slot="message-scroller-viewport"]');
        return { width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth, viewport: viewport ? { scrollTop: viewport.scrollTop, scrollHeight: viewport.scrollHeight, clientHeight: viewport.clientHeight } : null };
      });
    } catch (captureError) { proof.failureCaptureError = captureError.message; }
  }
  process.exitCode = 1;
} finally {
  const cleanupErrors = [];
  try { if (context) await context.tracing.stop({ path: path.join(run.artifacts, 'failure-trace.zip') }); } catch (error) { cleanupErrors.push(`trace: ${error.message}`); }
  try { if (browser) await browser.close(); } catch (error) { cleanupErrors.push(`browser: ${error.message}`); }
  for (const { child, closed } of servers.reverse()) {
    try {
      if (child.pid) {
        try { process.kill(-child.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
        await Promise.race([closed, delay(3000)]);
        try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
        await closed;
      }
    } catch (error) { cleanupErrors.push(`server: ${error.message}`); }
  }
  if (servers.length) for (const port of [run.apiPort, run.webPort]) {
    try { await portIsFree(port); } catch (error) { cleanupErrors.push(`port ${port}: ${error.message}`); }
  }
  proof.cleanup = cleanupErrors.length === 0;
  if (cleanupErrors.length) { proof.cleanupErrors = cleanupErrors; proof.result = 'failed'; process.exitCode = 1; }
  await new Promise((resolve) => log.end(resolve));
  await writeFile(path.join(run.artifacts, 'proof.json'), JSON.stringify(proof, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ result: proof.result, cleanup: proof.cleanup, artifacts: run.artifacts, commit: run.commit }) + '\n');
}
