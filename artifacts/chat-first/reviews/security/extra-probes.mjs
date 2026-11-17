import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const cwd = '/Users/josiahwong/Documents/research-shopping-chat-security';
const require = createRequire(`${cwd}/package.json`);
const { chromium } = require('@playwright/test');
const base = 'http://127.0.0.1:5305';
const child = spawn('npm', ['run', 'dev'], { cwd, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, API_PORT: '3195', VITE_API_PORT: '3195', WEB_PORT: '5305', EXA_RESEARCH_ENABLED: 'false' } });
let serverLog = '';
child.stdout.on('data', b => serverLog += b);
child.stderr.on('data', b => serverLog += b);
const result = { head: '38f75c271ba5396950b1fe37892350497ac15709', probes: [], cleanup: false };
let browser;
try {
  let health;
  for (let i=0; i<100; i++) {
    try { health = await (await fetch(`${base}/api/health`)).json(); if (health.status === 'ok') break; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  assert.deepEqual(health, { status: 'ok', mode: 'fixture', liveIntegrations: false, webResearch: 'disabled' });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(base);
  const payload = `<img src=x onerror="window.__securityProbe='executed'">`;
  await page.getByLabel('Message', { exact: true }).fill(payload);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await page.getByRole('heading', { name: 'One thing to clarify' }).waitFor();
  assert.equal(await page.getByTestId('user-message').textContent(), payload);
  assert.equal(await page.locator('[data-testid="user-message"] img').count(), 0);
  assert.equal(await page.evaluate(() => window.__securityProbe), undefined);
  result.probes.push('User message markup stayed inert text');
  await page.route('**/api/turn', async route => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: { kind: 'message', message: payload, preferences: body.preferences, notes: [], toolActivity: [] } });
  });
  await page.getByLabel('Message', { exact: true }).fill('hi');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await page.getByTestId('assistant-message').last().getByText(payload, { exact: true }).waitFor();
  assert.equal(await page.locator('[data-testid="assistant-message"] img').count(), 0);
  assert.equal(await page.evaluate(() => window.__securityProbe), undefined);
  result.probes.push('New assistant message response markup stayed inert text');
  await page.unroute('**/api/turn');
  await page.route('**/api/turn', async route => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: { kind: 'message', message: 'x'.repeat(401), preferences: body.preferences, notes: [], toolActivity: [] } });
  });
  await page.getByLabel('Message', { exact: true }).fill('hi');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await page.getByRole('alert').getByText('The research service returned an unreadable result.', { exact: true }).waitFor();
  result.probes.push('Oversized new message variant rejected at response boundary');
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Storage blocked', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('Storage blocked', 'SecurityError'); };
  });
  const storagePage = await context.newPage();
  await storagePage.goto(base);
  assert.equal(await storagePage.locator('html').getAttribute('class'), 'dark');
  await storagePage.getByRole('button', { name: 'Switch to light mode' }).click();
  await storagePage.getByRole('button', { name: 'Switch to dark mode' }).waitFor();
  assert.equal(await storagePage.locator('html').getAttribute('class'), 'light');
  result.probes.push('Blocked localStorage preserved dark default and usable theme toggle');
  await context.close();
  result.result = 'passed';
} catch (error) {
  result.result = 'failed';
  result.error = String(error?.stack ?? error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  try { process.kill(-child.pid, 'SIGTERM'); } catch {}
  for (let i=0; i<50; i++) {
    try { await fetch(`${base}/api/health`); } catch { result.cleanup = true; break; }
    await new Promise(r => setTimeout(r, 100));
  }
  await writeFile('/tmp/research-shopping-chat/security/extra-probes-server.txt', serverLog);
  await writeFile('/tmp/research-shopping-chat/security/extra-probes.json', JSON.stringify(result, null, 2)+'\n');
  console.log(JSON.stringify(result, null, 2));
}
