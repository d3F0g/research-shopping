#!/usr/bin/env node
import assert from 'node:assert/strict';
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
const run = {
  repo,
  apiPort: Number(process.env.VERIFY_API_PORT ?? 3173),
  webPort: Number(process.env.VERIFY_WEB_PORT ?? 5283),
  artifacts: path.resolve(process.env.VERIFY_ARTIFACT_DIR ?? path.join(repo, 'artifacts/verification-skill', new Date().toISOString().replaceAll(':', '-'))),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  worktreeStatus: execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' }).trim(),
};
assert(Number.isInteger(run.apiPort) && Number.isInteger(run.webPort) && run.apiPort !== run.webPort, 'Use two distinct integer ports');
const { chromium } = createRequire(path.join(repo, 'package.json'))('@playwright/test');
await mkdir(run.artifacts, { recursive: true });
const proof = { ...run, feature: 'chat-first-shopping', actions: [], result: 'failed', cleanup: false };
const log = createWriteStream(path.join(run.artifacts, 'server.log'));
let server;
let serverClosed;
let browser;
let context;
let failed;

async function portIsFree(port) {
  await new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.once('error', reject);
    listener.listen(port, '127.0.0.1', () => listener.close(resolve));
  });
}

try {
  await portIsFree(run.apiPort);
  await portIsFree(run.webPort);
  server = spawn('npm', ['run', 'dev'], {
    cwd: repo,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'test', FIELDNOTE_TEST_FIXTURES: 'true', EXA_RESEARCH_ENABLED: 'false', API_PORT: String(run.apiPort), VITE_API_PORT: String(run.apiPort), WEB_PORT: String(run.webPort) },
  });
  server.stdout.pipe(log, { end: false });
  server.stderr.pipe(log, { end: false });
  serverClosed = new Promise((resolve) => server.once('close', resolve));
  server.once('error', (error) => { failed = error; });
  proof.serverPid = server.pid;
  const baseURL = `http://127.0.0.1:${run.webPort}`;
  const deadline = Date.now() + 60_000;
  while (true) {
    if (failed) throw failed;
    assert(server.exitCode === null, 'Owned dev server exited before readiness');
    try {
      const response = await fetch(`${baseURL}/api/health`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) {
        const health = await response.json();
        assert.equal(health.status, 'ok');
        assert.equal(health.mode, 'fixture');
        assert.equal(health.liveIntegrations, false);
        assert.equal(health.webResearch, 'disabled');
        proof.health = health;
        break;
      }
    } catch (error) {
      if (Date.now() >= deadline) throw error;
    }
    assert(Date.now() < deadline, 'API readiness timed out');
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', reducedMotion: 'reduce' });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  const unexpectedNetwork = [];
  const pageErrors = [];
  let researchRequests = 0;
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== baseURL) unexpectedNetwork.push(request.url());
    if (url.pathname === '/api/research') researchRequests += 1;
  });
  const composer = page.getByRole('textbox', { name: 'Message', exact: true });
  const activeTurn = page.locator('[data-testid="conversation-turn"][data-active="true"]');
  const latestTurn = page.getByTestId('conversation-turn').last();
  const history = page.getByLabel('Conversation history', { exact: true });
  const screenshot = (name) => page.screenshot({ path: path.join(run.artifacts, name) });
  const submit = async (message) => {
    const response = page.waitForResponse((result) => new URL(result.url()).pathname === '/api/turn');
    await composer.fill(message);
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    const result = await response;
    assert.equal(result.status(), 200);
    const body = await result.json();
    await page.getByRole('button', { name: 'Send message', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Stop response', exact: true }).waitFor({ state: 'hidden' });
    await latestTurn.waitFor();
    return body;
  };
  const assertOffers = (turn, cap) => {
    assert.equal(turn.kind, 'recommendations');
    assert(turn.candidates.length > 0);
    for (const { product, offer } of turn.candidates) {
      assert.equal(product.category, 'headphones');
      assert.equal(offer.price.currency, 'SGD');
      assert(offer.price.amount <= cap);
      assert.equal(offer.dataKind, 'fixture');
    }
  };
  const assertComposerVisible = async () => {
    const box = await composer.boundingBox();
    const viewport = page.viewportSize();
    assert(box && box.y >= 0 && box.y + box.height <= viewport.height, 'Composer must remain inside the viewport');
    assert(await page.getByRole('button', { name: 'Send message', exact: true }).isVisible(), 'Send action must remain available');
    return { top: box.y, bottom: box.y + box.height, viewportHeight: viewport.height };
  };
  await page.goto(baseURL);
  await page.getByLabel('Shopping conversation', { exact: true }).waitFor();
  await page.getByText('Fixture data', { exact: true }).waitFor();
  await page.getByRole('heading', { name: 'What are you looking for?', exact: true }).waitFor();
  await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
  assert.equal(await page.locator('.product-card').count(), 0);
  assert.equal(await page.locator('.preferences-panel').count(), 0);
  assert.equal(await page.locator('.empty-results').count(), 0);
  assert(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth), 'Empty chat must fit the viewport');
  proof.actions.push('Doctor confirmed owned ports, offline fixture health, minimal empty chat and dark mode despite light OS preference.');
  await screenshot('01-dark-empty-desktop.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth, undefined, { timeout: 5000 });
  await screenshot('01b-dark-empty-mobile.png');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
  await page.reload();
  await page.waitForFunction(() => document.documentElement.classList.contains('light'));
  await composer.waitFor();
  await screenshot('02-light-empty-desktop.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot('02b-light-empty-mobile.png');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
  await page.reload();
  await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
  await composer.waitFor();
  proof.theme = { firstVisit: 'dark', osPreference: 'light', lightPersistedAfterRefresh: true, darkPersistedAfterRefresh: true };
  proof.actions.push('Changed the actual theme control to light and dark and confirmed each selection after refresh.');
  const greeting = await submit('Hi');
  assert.equal(greeting.kind, 'message');
  assert.equal(greeting.preferences.hard.category, null);
  assert.equal(greeting.preferences.hard.budget, null);
  assert.deepEqual(greeting.toolActivity, []);
  assert.equal(await latestTurn.locator('.product-card').count(), 0);
  await latestTurn.getByText(greeting.message, { exact: true }).waitFor();
  assert((await latestTurn.getByTestId('assistant-message').innerText()).includes(greeting.message));
  await screenshot('03-ordinary-message-desktop.png');
  const question = await submit('Something good for work');
  assert.equal(question.kind, 'clarification');
  await latestTurn.getByRole('button', { name: 'Headphones', exact: true }).waitFor();
  assert.equal(await latestTurn.locator('.product-card').count(), 0);
  await screenshot('04-inline-question-desktop.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot('05-inline-question-mobile.png');
  await latestTurn.getByRole('button', { name: 'Headphones', exact: true }).click();
  await latestTurn.getByRole('heading', { name: 'Any budget in mind?', exact: true }).waitFor();
  await screenshot('06-optional-budget-mobile.png');
  const skipResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/turn');
  await latestTurn.getByRole('button', { name: 'Skip budget', exact: true }).click();
  const skipped = await (await skipResponse).json();
  assert.equal(skipped.kind, 'recommendations');
  assert.equal(skipped.preferences.hard.category, 'headphones');
  assert.equal(skipped.preferences.hard.budget, null);
  await activeTurn.locator('.product-card').first().waitFor();
  const afterSkip = await submit('better battery life');
  assert.equal(afterSkip.kind, 'recommendations');
  assert.equal(afterSkip.preferences.hard.budget, null);
  await activeTurn.locator('.product-card').first().waitFor();
  assert.equal(await activeTurn.getByRole('heading', { name: 'Any budget in mind?', exact: true }).count(), 0);
  proof.optionalBudget = { skipped: true, budgetRemainedUnknown: true, notAskedAgainInSameContext: true };
  proof.actions.push('Submitted an ordinary greeting, chose an inline missing-category answer, skipped an optional budget question and confirmed it was not repeated on a relevant follow-up.');
  await page.setViewportSize({ width: 1440, height: 1000 });
  const firstMessage = 'Wireless headphones for long flights, under S$500';
  const first = await submit(firstMessage);
  assertOffers(first, 500);
  assert.equal(first.preferences.hard.budget.amount, 500);
  await activeTurn.locator('.product-card').first().waitFor();
  assert.equal(await activeTurn.getByRole('heading', { name: 'Any budget in mind?', exact: true }).count(), 0);
  assert.equal(await activeTurn.getByRole('button', { name: 'Headphones', exact: true }).count(), 0);
  assert.equal(await activeTurn.getByRole('button', { name: 'Laptops', exact: true }).count(), 0);
  const firstTurnId = await activeTurn.getAttribute('data-turn-id');
  assert(firstTurnId);
  assert.equal(await activeTurn.locator('.product-card').count(), first.candidates.length);
  assert(await activeTurn.getByText('Sample price · fixture only', { exact: true }).count() > 0);
  await activeTurn.getByRole('button', { name: 'Edit preferences', exact: true }).click();
  assert.equal(await activeTurn.getByLabel('Maximum budget amount').inputValue(), '500');
  assert.equal(await activeTurn.getByLabel('Product type').inputValue(), 'headphones');
  await screenshot('07-contextual-editor-desktop.png');
  await page.getByRole('button', { name: 'Close preferences', exact: true }).click();
  const next = await submit('under S$200');
  assertOffers(next, 200);
  await activeTurn.locator('.product-card').first().waitFor();
  assert.equal(next.preferences.hard.budget.amount, 200);
  assert.deepEqual(next.preferences.hard.requiredFeatures, first.preferences.hard.requiredFeatures);
  const historicalTurn = page.getByTestId('conversation-turn').filter({ has: page.getByTestId('user-message').filter({ hasText: firstMessage }) });
  assert.equal(await historicalTurn.count(), 1);
  assert.equal(await historicalTurn.getAttribute('data-turn-id'), firstTurnId);
  assert.equal(await historicalTurn.locator('.product-card').count(), first.candidates.length);
  const oldActions = historicalTurn.getByRole('button', { name: 'Select this product', exact: true });
  const oldActionCount = await oldActions.count();
  for (const action of await oldActions.all()) assert(await action.isDisabled(), 'Historical selections must not use obsolete constraints');
  assert.equal((await activeTurn.getByTestId('user-message').innerText()).trim(), 'under S$200');
  assert(await page.getByTestId('user-message').count() >= 4);
  assert(await page.getByTestId('assistant-message').count() >= 4);
  proof.history = { firstTurnId, firstBudget: 500, currentBudget: 200, earlierExchangeRetained: true, historicalSelectionActions: oldActionCount, obsoleteSelectionActionsUnavailable: true, userMessages: await page.getByTestId('user-message').count(), assistantMessages: await page.getByTestId('assistant-message').count() };
  proof.candidates = next.candidates.map(({ product, offer }) => ({ id: product.id, price: offer.price, dataKind: offer.dataKind }));
  proof.actions.push('Submitted a complete request without repeated category/budget questions, then changed the cap naturally while retaining earlier exchanges and making obsolete selection actions unavailable.');
  proof.composer = { desktop: await assertComposerVisible() };
  await screenshot('08-history-desktop.png');
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile page has horizontal overflow');
  assert(await history.evaluate((element) => element.scrollHeight > element.clientHeight), 'History must actually scroll for the mobile check');
  await history.hover();
  await page.mouse.wheel(0, -10000);
  await page.waitForFunction(() => document.querySelector('[data-slot="message-scroller-viewport"]').scrollTop <= 1);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert(await history.evaluate((element) => element.scrollTop <= 1), 'History must remain at the older messages after user scrolling');
  const mobileTop = await assertComposerVisible();
  await screenshot('09-history-top-mobile.png');
  await history.hover();
  await page.mouse.wheel(0, 10000);
  await page.waitForFunction(() => { const element = document.querySelector('[data-slot="message-scroller-viewport"]'); return element.scrollHeight - element.clientHeight - element.scrollTop <= 1; });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const mobileBottom = await assertComposerVisible();
  assert(Math.abs(mobileTop.top - mobileBottom.top) <= 1, 'Composer must stay anchored while history scrolls');
  proof.composer.mobile = { olderHistory: mobileTop, latestHistory: mobileBottom, stableWhileScrolling: true };
  await screenshot('10-history-latest-mobile.png');
  const currentTurn = page.getByTestId('conversation-turn').filter({ has: page.getByTestId('user-message').filter({ hasText: 'under S$200' }) });
  const card = currentTurn.locator('.product-card').first();
  await card.getByRole('button', { name: 'Evidence and limits', exact: true }).click();
  await card.getByText('Claims are synthetic fixture data.', { exact: false }).waitFor();
  const reference = card.getByRole('link', { name: /Manufacturer reference\/model page/ }).first();
  await reference.waitFor();
  assert.equal(await reference.getAttribute('href'), next.candidates[0].product.productUrl);
  await screenshot('11-evidence-mobile.png');
  proof.actions.push('Scrolled older and newer mobile history with an anchored visible composer, then checked current product evidence against its exact manufacturer reference.');
  const selectionResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/select');
  await card.getByRole('button', { name: 'Select this product', exact: true }).click();
  const selection = await (await selectionResponse).json();
  assert.equal(selection.kind, 'handoff');
  const link = currentTurn.getByRole('link', { name: /Open manufacturer product page/ });
  await link.waitFor();
  assert.equal(await link.getAttribute('href'), selection.productUrl);
  assert.equal(await link.getAttribute('target'), '_blank');
  const rel = (await link.getAttribute('rel') ?? '').split(/\s+/);
  assert(rel.includes('noopener') && rel.includes('noreferrer'));
  const destination = new URL(selection.productUrl);
  assert.equal(destination.protocol, 'https:');
  assert.equal(destination.username + destination.password + destination.port, '');
  proof.handoff = { productId: selection.productId, destination: selection.productUrl };
  await link.scrollIntoViewIfNeeded();
  await screenshot('12-handoff-mobile.png');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await link.scrollIntoViewIfNeeded();
  await screenshot('13-handoff-desktop.png');
  proof.actions.push('Selected from the current turn and compared the safe displayed handoff link with the actual API response without opening the destination.');
  assert.deepEqual(unexpectedNetwork, [], 'Browser issued unexpected external requests');
  assert.deepEqual(pageErrors, [], 'Browser reported page errors');
  assert.equal(researchRequests, 0, 'Fixture chat must not start optional paid web research automatically');
  proof.externalRequests = unexpectedNetwork;
  proof.pageErrors = pageErrors;
  proof.webResearchRequests = researchRequests;
  proof.result = 'passed';
} catch (error) {
  proof.error = error.stack ?? String(error);
  const failedPage = context?.pages()[0];
  if (failedPage) {
    try {
      await failedPage.screenshot({ path: path.join(run.artifacts, 'failure.png') });
      proof.failureState = await failedPage.evaluate(() => {
        const viewport = document.querySelector('[data-slot="message-scroller-viewport"]');
        const messages = document.querySelectorAll('[data-testid="assistant-message"]');
        const last = messages[messages.length - 1];
        return { document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, viewportWidth: innerWidth, viewportHeight: innerHeight }, viewport: viewport ? { height: viewport.clientHeight, scrollHeight: viewport.scrollHeight, scrollTop: viewport.scrollTop, visibility: getComputedStyle(viewport).visibility, pendingScroll: viewport.hasAttribute('data-pending-scroll') } : null, assistantMessages: messages.length, lastAssistantTextLength: last?.textContent?.length, lastAssistantRenderedTextLength: last instanceof HTMLElement ? last.innerText.length : null };
      });
    } catch (captureError) { proof.failureCaptureError = captureError.message; }
  }
  process.exitCode = 1;
} finally {
  const cleanupErrors = [];
  try {
    if (context) await context.tracing.stop({ path: path.join(run.artifacts, 'trace.zip') });
  } catch (error) { cleanupErrors.push(`trace: ${error.message}`); }
  try {
    if (browser) await browser.close();
  } catch (error) { cleanupErrors.push(`browser: ${error.message}`); }
  if (server?.pid) {
    try {
      try { process.kill(-server.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
      await Promise.race([serverClosed, new Promise((resolve) => setTimeout(resolve, 5000))]);
      try { process.kill(-server.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
      await serverClosed;
    } catch (error) { cleanupErrors.push(`server: ${error.message}`); }
    for (const port of [run.apiPort, run.webPort]) {
      try { await portIsFree(port); } catch (error) { cleanupErrors.push(`port ${port}: ${error.message}`); }
    }
  }
  proof.cleanup = cleanupErrors.length === 0;
  if (cleanupErrors.length) {
    proof.cleanupErrors = cleanupErrors;
    proof.result = 'failed';
    process.exitCode = 1;
  }
  await new Promise((resolve) => log.end(resolve));
  await writeFile(path.join(run.artifacts, 'proof.json'), JSON.stringify(proof, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ result: proof.result, cleanup: proof.cleanup, artifacts: run.artifacts, commit: run.commit }) + '\n');
}
