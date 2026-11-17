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
const proof = { ...run, feature: 'research-request', actions: [], result: 'failed', cleanup: false };
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
    env: { ...process.env, API_PORT: String(run.apiPort), VITE_API_PORT: String(run.apiPort), WEB_PORT: String(run.webPort) },
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
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  const unexpectedNetwork = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== baseURL) unexpectedNetwork.push(request.url());
  });
  await page.goto(baseURL);
  await page.getByRole('region', { name: 'Product research workspace' }).waitFor();
  await page.getByText('FIXTURE MODE', { exact: true }).waitFor();
  proof.actions.push('Doctor confirmed owned fresh ports, fixture health, and research workspace.');
  await page.screenshot({ path: path.join(run.artifacts, '01-start.png'), fullPage: true });
  const turnResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/turn');
  await page.getByRole('button', { name: /Wireless headphones for long flights, under S\$500/ }).click();
  const turn = await (await turnResponse).json();
  assert.equal(turn.kind, 'recommendations');
  assert(turn.candidates.length > 0);
  for (const candidate of turn.candidates) {
    assert.equal(candidate.product.category, 'headphones');
    assert.equal(candidate.offer.price.currency, 'SGD');
    assert(candidate.offer.price.amount <= 500);
    assert.equal(candidate.offer.dataKind, 'fixture');
  }
  proof.candidates = turn.candidates.map(({ product, offer }) => ({ id: product.id, price: offer.price, dataKind: offer.dataKind }));
  await page.getByRole('heading', { name: 'Your shortlist' }).waitFor();
  await page.locator('.product-card').first().waitFor();
  assert.equal(await page.getByLabel('Maximum budget amount').inputValue(), '500');
  assert.equal(await page.getByLabel('Product type').inputValue(), 'headphones');
  assert(await page.getByText('Sample price · fixture only', { exact: true }).count() > 0);
  proof.actions.push('Clicked the first example request. Received headphones within the displayed SGD 500 hard budget and visible sample disclosures.');
  await page.screenshot({ path: path.join(run.artifacts, '02-shortlist-desktop.png'), fullPage: true });
  await page.locator('.product-card').first().getByText('Evidence and limits').click();
  await page.getByText('Claims are synthetic fixture data.', { exact: false }).first().waitFor();
  const reference = page.locator('.product-card').first().getByRole('link', { name: /Manufacturer reference\/model page/ }).first();
  await reference.waitFor();
  assert.equal(await reference.getAttribute('href'), turn.candidates[0].product.productUrl);
  proof.actions.push('Opened the first product evidence disclosure and checked its clickable manufacturer reference against the product URL.');
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Mobile page has horizontal overflow');
  await page.screenshot({ path: path.join(run.artifacts, '03-shortlist-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const selectionResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/select');
  await page.getByRole('button', { name: 'Select this product' }).first().click();
  const selection = await (await selectionResponse).json();
  assert.equal(selection.kind, 'handoff');
  const link = page.getByRole('link', { name: 'Open manufacturer product page' });
  await link.waitFor();
  assert.equal(await link.getAttribute('href'), selection.productUrl);
  const destination = new URL(selection.productUrl);
  assert.equal(destination.protocol, 'https:');
  assert.equal(destination.username + destination.password + destination.port, '');
  proof.actions.push('Selected the first product. The displayed manufacturer link equals the API handoff URL. Did not open the merchant page.');
  proof.handoff = { productId: selection.productId, destination: selection.productUrl };
  await page.screenshot({ path: path.join(run.artifacts, '04-handoff.png'), fullPage: true });
  assert.deepEqual(unexpectedNetwork, [], 'Browser issued unexpected external requests');
  proof.externalRequests = unexpectedNetwork;
  proof.result = 'passed';
} catch (error) {
  proof.error = error.stack ?? String(error);
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
