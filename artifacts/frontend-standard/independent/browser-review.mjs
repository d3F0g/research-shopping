import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const project = '/Users/josiahwong/Documents/research-shopping-shadcn-qa';
const output = '/Users/josiahwong/Documents/research-shopping/artifacts/frontend-standard/independent';
const require = createRequire(`${project}/package.json`);
const { chromium, expect } = require('@playwright/test');
const proof = { commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: project, encoding: 'utf8' }).trim(), checks: [], externalRequests: [], errors: [], cleanup: false };
const log = [];
let browser;
let server;
const screenshot = async (page, name, fullPage = false) => {
  await page.screenshot({ path: `${output}/${name}.png`, fullPage, animations: 'disabled' });
};
const check = async (page, label) => {
  const widths = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  assert(widths.document <= widths.viewport && widths.body <= widths.viewport, `${label} overflow ${JSON.stringify(widths)}`);
  proof.checks.push({ label, widths });
};
const visible = async (locator) => { await locator.waitFor({ state: 'visible' }); };
const research = async (page, prompt = 'Headphones under S$400') => {
  await page.getByLabel('Start with the outcome, not a model number.').fill(prompt);
  const response = page.waitForResponse((r) => r.url().endsWith('/api/turn') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Research options', exact: true }).click();
  const payload = await (await response).json();
  await visible(page.getByRole('heading', { name: 'Your shortlist' }));
  return payload;
};
try {
  await mkdir(output, { recursive: true });
  for (const port of [3573, 5673]) {
    try { await fetch(`http://127.0.0.1:${port}/api/health`); throw new Error(`Port ${port} occupied`); } catch (e) { if (e.message.includes('occupied')) throw e; }
  }
  server = spawn('npm', ['run', 'dev'], { cwd: project, detached: true, env: { ...process.env, API_PORT: '3573', VITE_API_PORT: '3573', WEB_PORT: '5673' }, stdio: ['ignore', 'pipe', 'pipe'] });
  proof.serverPid = server.pid;
  server.stdout.on('data', (chunk) => log.push(chunk.toString()));
  server.stderr.on('data', (chunk) => log.push(chunk.toString()));
  for (let i = 0; i < 120; i++) {
    try { const h = await (await fetch('http://127.0.0.1:5673/api/health')).json(); if (h.status === 'ok') { proof.health = h; break; } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.equal(proof.health?.mode, 'fixture');
  assert.equal(proof.health.liveIntegrations, false);
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    proof.externalRequests.push(url.href);
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => proof.errors.push(error.message));
  let navigations = 0;
  page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) navigations++; });
  await page.goto('http://127.0.0.1:5673');
  await page.evaluate(() => document.fonts.ready);
  assert(await page.evaluate(() => document.fonts.check('14px "Geist Variable"')));
  await visible(page.getByText('FIXTURE MODE', { exact: true }));
  await expect(page.getByText('A useful answer, with the trade-offs close by.')).toBeVisible();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await check(page, 'desktop initial');
  await screenshot(page, '01-desktop-initial');
  const request = page.getByLabel('Start with the outcome, not a model number.');
  for (let i = 0; i < 35 && !(await request.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  assert(await request.evaluate((el) => el === document.activeElement));
  const outline = await request.evaluate((el) => ({ width: getComputedStyle(el).outlineWidth, style: getComputedStyle(el).outlineStyle }));
  assert(parseFloat(outline.width) >= 3 && outline.style === 'solid');
  await screenshot(page, '02-desktop-keyboard-focus');
  let release;
  let started;
  const requestStarted = new Promise((resolve) => { started = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/turn', async (route) => { const response = await route.fetch(); started(); await gate; await route.fulfill({ response }); });
  await page.getByRole('button', { name: /Wireless headphones for long flights/ }).click();
  await requestStarted;
  await visible(page.getByRole('status'));
  assert.equal(await page.getByRole('button', { name: /Recorded activity/ }).count(), 0);
  await screenshot(page, '03-desktop-pending');
  await page.setViewportSize({ width: 390, height: 844 });
  await visible(page.getByRole('button', { name: /Filters and preferences/ }));
  await screenshot(page, '21-mobile-pending');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await visible(page.getByLabel('Product type'));
  const turnResponse = page.waitForResponse('**/api/turn');
  release();
  const payload = await (await turnResponse).json();
  await visible(page.getByRole('heading', { name: 'Your shortlist' }));
  await page.unroute('**/api/turn');
  await screenshot(page, '04-desktop-results', true);
  await check(page, 'desktop results');
  const activity = page.getByRole('button', { name: `Recorded activity · ${payload.toolActivity.length} outcomes` });
  await activity.click();
  const rows = page.locator('.tool-activity [data-slot="trace-collapsible-content"] [data-slot="trace-line"]');
  assert.equal(await rows.count(), payload.toolActivity.length);
  const providers = { discovery: 'Catalog discovery', research: 'Fixture research', merchant: 'Sample offer check' };
  const outcomes = { ok: 'Completed', failed: 'Failed', timeout: 'Timed out' };
  for (const [i, event] of payload.toolActivity.entries()) assert.equal((await rows.nth(i).textContent()).trim(), `${providers[event.provider]} · ${outcomes[event.outcome]}`);
  proof.activity = payload.toolActivity;
  await screenshot(page, '05-desktop-recorded-activity', true);
  const sony = page.getByRole('article', { name: 'Sony WH-CH720N', exact: true });
  await sony.getByRole('button', { name: 'Evidence and limits' }).click();
  await visible(sony.getByText('CONFLICTING SAMPLE CLAIMS', { exact: true }));
  await visible(sony.getByText('UNKNOWN', { exact: true }).first());
  await sony.getByRole('button', { name: /Preview reference/ }).first().hover();
  await visible(page.locator('[data-slot="hover-card-content"]'));
  await screenshot(page, '06-desktop-citation', true);
  await page.mouse.move(0, 0);
  await expect(page.locator('[data-slot="hover-card-content"]')).toBeHidden();
  const compare = page.getByRole('button', { name: /Compare .* sample options/ });
  await compare.focus();
  await page.keyboard.press('Enter');
  await visible(page.getByRole('table'));
  await compare.scrollIntoViewIfNeeded();
  await screenshot(page, '07-desktop-comparison');
  await page.setViewportSize({ width: 390, height: 844 });
  await visible(page.getByRole('button', { name: /Filters and preferences/ }));
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(() => scrollTo(0, 0));
  await screenshot(page, '08-mobile-before-overflow-check');
  await check(page, 'mobile results');
  const answer = await page.locator('.answer-first').boundingBox();
  assert(answer.y < 700, `Mobile answer begins at ${answer.y}`);
  proof.mobileAnswerY = answer.y;
  assert.equal(await page.getByRole('button', { name: 'Example requests', exact: true }).getAttribute('aria-expanded'), 'false');
  await screenshot(page, '08-mobile-results');
  await sony.scrollIntoViewIfNeeded();
  await screenshot(page, '09-mobile-evidence', true);
  const source = sony.getByRole('link', { name: /Manufacturer reference\/model page/ }).first();
  assert.equal(await source.getAttribute('href'), 'https://www.sony.com.sg/headphones/products/wh-ch720n');
  await source.focus();
  await screenshot(page, '10-mobile-source-keyboard');
  await compare.scrollIntoViewIfNeeded();
  await screenshot(page, '11-mobile-comparison');
  const tableWrapper = page.locator('[data-slot="table-container"]');
  proof.mobileTable = await tableWrapper.evaluate((el) => ({ width: el.clientWidth, scrollWidth: el.scrollWidth, overflowX: getComputedStyle(el).overflowX }));
  const trigger = page.getByRole('button', { name: /Filters and preferences/ });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Your filters' });
  await visible(dialog);
  for (let i = 0; i < 30; i++) { await page.keyboard.press('Tab'); await expect.poll(() => dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true); }
  await dialog.getByLabel('Maximum budget amount').scrollIntoViewIfNeeded();
  await check(page, 'mobile sheet');
  await screenshot(page, '12-mobile-sheet');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await sony.getByRole('button', { name: 'Select this product' }).click();
  const handoff = page.getByRole('region', { name: 'Sony WH-CH720N', exact: true });
  await visible(handoff);
  await handoff.getByRole('heading', { name: 'Sony WH-CH720N', exact: true }).scrollIntoViewIfNeeded();
  await screenshot(page, '13-mobile-handoff', true);
  await check(page, 'mobile handoff');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await screenshot(page, '14-desktop-handoff', true);
  await page.getByRole('button', { name: 'Reset session', exact: true }).click();
  await page.route('**/api/turn', (route) => route.abort());
  await request.fill('Headphones under S$400');
  await page.getByRole('button', { name: 'Research options', exact: true }).click();
  await visible(page.getByRole('alert'));
  await screenshot(page, '15-desktop-error');
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot(page, '16-mobile-error');
  await page.unroute('**/api/turn');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await visible(page.getByRole('heading', { name: 'Your shortlist' }));
  await screenshot(page, '17-mobile-retry');
  await page.getByRole('button', { name: 'Reset session', exact: true }).click();
  await screenshot(page, '18-mobile-initial', true);
  await request.fill('Something nice');
  const clarifyResponse = page.waitForResponse('**/api/turn');
  await page.getByRole('button', { name: 'Research options', exact: true }).click();
  const clarification = await (await clarifyResponse).json();
  await visible(page.getByRole('heading', { name: 'One thing to clarify' }));
  assert.deepEqual(clarification.toolActivity, []);
  assert.equal(await page.getByRole('button', { name: /Recorded activity/ }).count(), 0);
  await screenshot(page, '19-mobile-clarification');
  await page.getByRole('button', { name: 'Reset session', exact: true }).click();
  await page.route('**/api/turn', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    for (const candidate of body.candidates ?? []) for (const claim of candidate.product.claims) {
      if (claim.status === 'supported') for (const source of claim.sources) source.url = 'https://example.invalid/injected-source';
      if (claim.status === 'conflict') for (const observation of claim.observations) observation.source.url = 'https://example.invalid/injected-source';
    }
    await route.fulfill({ response, body: JSON.stringify(body) });
  });
  await research(page);
  await page.getByRole('article', { name: 'Sony WH-CH720N', exact: true }).getByRole('button', { name: 'Evidence and limits' }).click();
  assert.equal(await page.locator('a[href*="example.invalid"]').count(), 0);
  proof.checks.push({ label: 'Injected unapproved source URLs cannot become links', injection: 'POST /api/turn response fixture claims only' });
  await page.unroute('**/api/turn');
  await check(page, 'mobile injected-source fallback');
  const beforeArtifact = navigations;
  await writeFile(`${output}/watch-ignore-probe.html`, '<!doctype html><title>Trace artifact probe</title>');
  await page.waitForTimeout(600);
  assert.equal(navigations, beforeArtifact);
  assert(!log.join('').includes('page reload artifacts/'));
  proof.checks.push({ label: 'Writing artifact HTML does not reload Vite page', navigations });
  assert.deepEqual(proof.externalRequests, []);
  assert.deepEqual(proof.errors, []);
  await context.tracing.stop({ path: `${output}/exploratory-trace.zip` });
  await context.close();
  const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const touchPage = await touch.newPage();
  await touchPage.goto('http://127.0.0.1:5673');
  await research(touchPage);
  const touchSony = touchPage.getByRole('article', { name: 'Sony WH-CH720N', exact: true });
  await touchSony.getByRole('button', { name: 'Evidence and limits' }).tap();
  await visible(touchSony.getByRole('link', { name: /Manufacturer reference\/model page/ }).first());
  await screenshot(touchPage, '20-mobile-touch-reference', true);
  await check(touchPage, 'touch reference');
  proof.checks.push({ label: 'Touch opens evidence with persistent manufacturer reference links; reduced motion enabled' });
  await touch.close();
  const manifestDir = '/Users/josiahwong/Documents/research-shopping-shadcn/artifacts/shadcn-owner';
  const manifest = JSON.parse(await readFile(`${manifestDir}/registry-manifest.json`, 'utf8'));
  const registry = [];
  for (const entry of manifest.registry) {
    const saved = await readFile(`${manifestDir}/registry/${entry.name}.json`);
    assert.equal(createHash('sha256').update(saved).digest('hex'), entry.sha256);
    registry.push({ name: entry.name, savedHashMatches: true });
  }
  for (const name of ['message-scroller', 'input-group', 'hover-card', 'trace', 'sheet']) {
    const entry = manifest.registry.find((item) => item.name === name);
    const response = await fetch(entry.url);
    assert(response.ok);
    const current = Buffer.from(await response.arrayBuffer());
    assert.equal(createHash('sha256').update(current).digest('hex'), entry.sha256);
    registry.find((item) => item.name === name).officialCurrentHashMatches = true;
  }
  proof.registry = registry;
  proof.result = 'passed';
} catch (error) {
  proof.result = 'failed';
  proof.failure = error.stack;
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server) {
    try { process.kill(-server.pid, 'SIGTERM'); } catch {}
    await new Promise((resolve) => setTimeout(resolve, 600));
    for (const port of [3573, 5673]) {
      try { await fetch(`http://127.0.0.1:${port}/api/health`); throw new Error(`Owned port ${port} remains live`); } catch (e) { if (e.message.includes('remains live')) proof.cleanupFailure = e.message; }
    }
    proof.cleanup = !proof.cleanupFailure;
  }
  await writeFile(`${output}/exploratory-server.log`, log.join(''));
  await writeFile(`${output}/proof.json`, `${JSON.stringify(proof, null, 2)}\n`);
  console.log(JSON.stringify(proof, null, 2));
}
