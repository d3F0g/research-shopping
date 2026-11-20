import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { accountRuntime } from "../../scripts/account-test-runtime.mjs";

const directory = "artifacts/issue-65-bootstrap-transport";
await mkdir(directory, { recursive: true });
const runtime = await accountRuntime({ web: true });
const browser = await chromium.launch();
const proof = [];
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    try {
      const page = await context.newPage();
      await page.goto(runtime.origin);
      const input = page.getByRole("textbox", { name: "Message", exact: true });
      const send = page.getByRole("button", { name: "Send message", exact: true });
      await input.fill("hello");
      await send.click();
      await expect(page.getByText("Hi. What are you looking to buy?", { exact: true })).toBeVisible();
      await input.fill("Fixture draft before authentication");
      await page.getByRole("button", { name: "Account", exact: true }).click();
      await page.getByRole("button", { name: "Create an account", exact: true }).click();
      await page.getByRole("textbox", { name: "Name", exact: true }).fill("Fixture shopper");
      await page.getByRole("textbox", { name: "Email", exact: true }).fill(`fixture-recovery-${randomUUID()}@example.test`);
      await page.getByLabel("Password", { exact: true }).fill("fixture-browser-password-only");
      let requests = 0;
      await page.route("**/api/account", (route) => { requests++; return route.fulfill({ status: 503, json: { error: "Fixture current account failure" } }); });
      await page.getByRole("button", { name: "Create account", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByText("The server is unavailable. Your draft is retained. Reload your account when it returns.", { exact: true })).toBeVisible();
      await expect(input).toHaveValue("Fixture draft before authentication");
      await expect(send).toBeDisabled();
      assert.equal(requests, 1);
      await page.unroute("**/api/account");
      await page.getByRole("button", { name: "Account", exact: true }).click();
      await page.getByRole("button", { name: "Reload account", exact: true }).click();
      await expect(page.getByText("Your saved conversation", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Close", exact: true }).click();
      await expect(input).toHaveValue("Fixture draft before authentication");
      await expect(send).toBeEnabled();
      await expect(page.getByRole("alert")).toHaveCount(0);
      const account = await page.evaluate(async () => (await fetch("/api/account")).json());
      assert.equal(account.status, "signed-in");
      assert.deepEqual(account.workspace.state.messages, []);
      await input.fill("hello");
      await send.click();
      await expect(page.getByText("Hi. What are you looking to buy?", { exact: true })).toBeVisible();
      await page.screenshot({ path: `${directory}/account-recovery-${viewport.width}.png` });
      await page.getByRole("button", { name: "Account", exact: true }).click();
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await expect(page.getByRole("heading", { name: "What are you looking for?", exact: true })).toBeVisible();
      assert.deepEqual((await page.evaluate(async () => (await fetch("/api/session")).json())).state.messages, []);
      await input.fill("thanks");
      await send.click();
      await expect(page.getByText("You're welcome. Tell me what you would like to change.", { exact: true })).toBeVisible();
      const guest = await page.evaluate(async () => (await fetch("/api/session")).json());
      assert.deepEqual(guest.state.messages.map((message) => message.text), ["thanks", "You're welcome. Tell me what you would like to change."]);
      await page.reload();
      await expect(page.getByText("thanks", { exact: true })).toBeVisible();
      assert.deepEqual((await page.evaluate(async () => (await fetch("/api/session")).json())).state.messages, guest.state.messages);
      assert.equal((await page.request.get(`${runtime.origin}/api/test-stats`).then((response) => response.json())).calls, 0);
      proof.push({ viewport, automaticRetries: requests - 1, savedAccount: account.status, guestMessages: guest.state.messages, providerCalls: 0 });
    } finally { await context.close(); }
  }
  await writeFile(`${directory}/account-recovery.json`, JSON.stringify({ result: "passed", proof }, null, 2));
  console.log("Desktop and mobile authentication failure, explicit recovery and sign-out history passed.");
} finally {
  await browser.close();
  await runtime.close();
}
