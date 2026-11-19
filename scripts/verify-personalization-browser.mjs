import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { accountRuntime } from "./account-test-runtime.mjs";
const runtime = await accountRuntime({ web: true });
const browser = await chromium.launch();
const proof = [];
await mkdir("artifacts/fieldnote-v2/accounts", { recursive: true });
async function authenticate(page, email, register) {
  await page.getByRole("button", { name: "Account", exact: true }).click();
  if (register)
    await page
      .getByRole("button", { name: "Create an account", exact: true })
      .click();
  if (register)
    await page
      .getByRole("textbox", { name: "Name", exact: true })
      .fill("Fixture shopper");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("fixture-browser-password-only");
  const response = page.waitForResponse((result) => result.url().endsWith(`/api/auth/${register ? "sign-up" : "sign-in"}/email`));
  await page
    .getByRole("button", {
      name: register ? "Create account" : "Sign in",
      exact: true,
    })
    .click();
  const result = await response;
  assert.equal(result.ok(), true, `Fixture authentication returned ${result.status()}`);
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
const send = async (page, text) => {
  await page.getByRole("textbox", { name: "Message", exact: true }).fill(text);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
};
try {
  for (const size of [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    const bootstrapRuntime = await accountRuntime({ web: true });
    try {
      for (const endpoint of ["account", "session"]) {
        for (const outcome of ["success", "failure"]) {
          const context = await browser.newContext({ viewport: size });
          const page = await context.newPage();
          let release;
          let entered;
          let requests = 0;
          const held = new Promise((resolve) => { entered = resolve; });
          const gate = new Promise((resolve) => { release = resolve; });
          await page.route(`**/api/${endpoint}`, async (route) => {
            if (++requests !== 1) return route.continue();
            const response = await route.fetch();
            entered();
            await gate;
            await route.fulfill(outcome === "success" ? { response } : { status: 503, json: { error: "Fixture stale bootstrap failure" } });
          });
          try {
            await page.goto(bootstrapRuntime.origin);
            await held;
            const callsBefore = (await page.request.get(`${bootstrapRuntime.origin}/api/test-stats`).then((response) => response.json())).calls;
            await expect(page.getByRole("button", { name: "New chat", exact: true })).toBeEnabled();
            await send(page, "hello");
            await expect(page.getByText("Hi. What are you looking to buy?", { exact: true })).toBeVisible();
            await authenticate(page, `fixture-bootstrap-${randomUUID()}@example.test`, true);
            await send(page, "thanks");
            await expect(page.getByText("thanks", { exact: true })).toBeVisible();
            const composer = page.getByRole("textbox", { name: "Message", exact: true });
            await composer.fill("Fixture draft after account creation");
            const pendingResponse = page.waitForResponse((response) => response.url().endsWith(`/api/${endpoint}`));
            release();
            await (await pendingResponse).finished();
            const account = await page.request.get(`${bootstrapRuntime.origin}/api/account`).then((response) => response.json());
            assert.equal(account.status, "signed-in");
            assert.equal(account.workspace.state.messages.some((message) => message.text === "thanks"), true);
            assert.equal(account.workspace.state.intent.budget, null);
            await expect(page.getByText("thanks", { exact: true })).toBeVisible();
            await expect(page.getByText("hello", { exact: true })).toHaveCount(0);
            await expect(composer).toHaveValue("Fixture draft after account creation");
            await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeEnabled();
            await expect(page.getByRole("alert")).toHaveCount(0);
            await page.getByRole("button", { name: "Account", exact: true }).click();
            await expect(page.getByText("Your saved conversation", { exact: true })).toBeVisible();
            await page.screenshot({ path: `artifacts/fieldnote-v2/accounts/${size.name}-late-${endpoint}-${outcome}.png` });
            await page.getByRole("button", { name: "Close", exact: true }).click();
            await send(page, "hello");
            await expect(page.getByText("Hi. What are you looking to buy?", { exact: true })).toBeVisible();
            assert.equal((await page.request.get(`${bootstrapRuntime.origin}/api/test-stats`).then((response) => response.json())).calls, callsBefore);
            proof.push(`${size.name} stale initial ${endpoint} ${outcome} preserves the signed-in conversation, draft and readiness without research.`);
          } finally {
            release();
            await context.close();
          }
        }
      }
    } finally {
      await bootstrapRuntime.close();
    }
    for (const transition of ["new-chat", "sign-in"]) {
      for (const outcome of ["success", "failure"]) {
        const stopRuntime = await accountRuntime({ web: true });
        const context = await browser.newContext({ viewport: size });
        let release = () => {};
        try {
          const page = await context.newPage();
          await page.goto(stopRuntime.origin);
          const stats = () => page.request.get(`${stopRuntime.origin}/api/test-stats`).then((response) => response.json());
          const before = await stats();
          const original = "I want a slow fixture powerbank under SGD40";
          await send(page, original);
          await expect.poll(async () => (await stats()).calls).toBe(before.calls + 1);
          let entered;
          let attempts = 0;
          const held = new Promise((resolve) => { entered = resolve; });
          const gate = new Promise((resolve) => { release = resolve; });
          await page.route("**/api/cancel", async (route) => {
            if (++attempts !== 1) return route.continue();
            const response = await route.fetch();
            entered();
            await gate;
            await route.fulfill(outcome === "success" ? { response } : { status: 503, json: { error: "Fixture stale cancellation failure" } });
          });
          await page.getByRole("button", { name: "Stop research", exact: true }).click();
          await held;
          await expect.poll(async () => (await stats()).closed).toBe(before.closed + 1);
          if (transition === "sign-in")
            await authenticate(page, `fixture-stop-${randomUUID()}@example.test`, true);
          else
            await page.getByRole("button", { name: "New chat", exact: true }).click();
          await expect(page.getByRole("heading", { name: "What are you looking for?" })).toBeVisible();
          await send(page, "hello");
          await expect(page.getByText("Hi. What are you looking to buy?", { exact: true })).toBeVisible();
          const composer = page.getByRole("textbox", { name: "Message", exact: true });
          await composer.fill("Fixture draft after stopped research");
          const pendingResponse = page.waitForResponse((response) => response.url().endsWith("/api/cancel"));
          release();
          await (await pendingResponse).finished();
          const account = await page.request.get(`${stopRuntime.origin}/api/account`).then((response) => response.json());
          const current = transition === "new-chat"
            ? await page.request.get(`${stopRuntime.origin}/api/session`).then((response) => response.json())
            : account.workspace;
          assert.equal(account.status, transition === "new-chat" ? "guest" : "signed-in");
          assert.equal(current.state.intent.budget, null);
          assert.equal(current.state.messages.some((message) => message.text === "hello"), true);
          assert.equal(current.state.messages.some((message) => message.text === original), false);
          await page.screenshot({ path: `artifacts/fieldnote-v2/accounts/${size.name}-late-stop-${transition}-${outcome}.png` });
          await expect(page.getByText(original, { exact: true })).toHaveCount(0);
          await expect(page.getByText("Hi. What are you looking to buy?", { exact: true })).toBeVisible();
          await expect(page.getByRole("alert")).toHaveCount(0);
          await expect(composer).toHaveValue("Fixture draft after stopped research");
          await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeEnabled();
          assert.equal((await stats()).calls, before.calls + 1);
          assert.equal(attempts, transition === "sign-in" ? 2 : 1);
          await send(page, "thanks");
          await expect(page.getByText("thanks", { exact: true })).toBeVisible();
          assert.equal((await stats()).calls, before.calls + 1);
          proof.push(`${size.name} late Stop ${outcome} after ${transition} preserves conversation, draft and readiness with one cancelled local SDK call and no retry.`);
        } finally {
          release();
          await context.close();
          await stopRuntime.close();
        }
      }
    }
    {
      const conflictRuntime = await accountRuntime({ web: true });
      const context = await browser.newContext({ viewport: size });
      let release = () => {};
      try {
        const page = await context.newPage();
        await page.goto(conflictRuntime.origin);
        await authenticate(page, `fixture-conflict-${randomUUID()}@example.test`, true);
        const stats = () => page.request.get(`${conflictRuntime.origin}/api/test-stats`).then((response) => response.json());
        const before = await stats();
        await send(page, "I want a slow fixture powerbank under SGD40");
        await expect.poll(async () => (await stats()).calls).toBe(before.calls + 1);
        let entered;
        let cancelled;
        const held = new Promise((resolve) => { entered = resolve; });
        const gate = new Promise((resolve) => { release = resolve; });
        await page.route("**/api/workspace", async (route) => {
          if (route.request().postDataJSON()?.phase !== "cancel") return route.continue();
          const response = await route.fetch();
          cancelled = await response.json();
          entered();
          await gate;
          await route.fulfill({ response });
        });
        await page.getByRole("button", { name: "Stop research", exact: true }).click();
        await held;
        await expect.poll(async () => (await stats()).closed).toBe(before.closed + 1);
        const resetResponse = page.waitForResponse((response) => response.url().endsWith("/api/workspace") && response.request().postDataJSON()?.phase === "new-chat");
        await page.getByRole("button", { name: "New chat", exact: true }).click();
        assert.equal((await resetResponse).status(), 409);
        await expect(page.getByText("The server could not start a new chat. Your history stays visible.", { exact: true })).toBeVisible();
        const composer = page.getByRole("textbox", { name: "Message", exact: true });
        await composer.fill("Fixture draft during workspace conflict");
        const current = await page.request.get(`${conflictRuntime.origin}/api/account`).then((response) => response.json());
        assert.deepEqual(current.workspace, cancelled.workspace);
        assert.equal(current.workspace.state.intent.budget.maximum, 40);
        assert.equal(current.workspace.state.intent.budget.currency, "SGD");
        assert.equal((await stats()).calls, before.calls + 1);
        await page.screenshot({ path: `artifacts/fieldnote-v2/accounts/${size.name}-stop-reset-conflict.png` });
        const pendingResponse = page.waitForResponse((response) => response.url().endsWith("/api/workspace") && response.request().postDataJSON()?.phase === "cancel");
        release();
        await (await pendingResponse).finished();
        await expect(composer).toHaveValue("Fixture draft during workspace conflict");
        await page.reload();
        await expect(page.getByRole("button", { name: "New chat", exact: true })).toBeEnabled();
        await page.getByRole("button", { name: "New chat", exact: true }).click();
        await expect(page.getByRole("heading", { name: "What are you looking for?" })).toBeVisible();
        await send(page, "hello");
        await expect(page.getByText("Hi. What are you looking to buy?", { exact: true })).toBeVisible();
        const recovered = await page.request.get(`${conflictRuntime.origin}/api/account`).then((response) => response.json());
        assert.equal(recovered.workspace.state.intent.budget, null);
        assert.equal((await stats()).calls, before.calls + 1);
        await page.screenshot({ path: `artifacts/fieldnote-v2/accounts/${size.name}-stop-reset-conflict-recovered.png` });
        proof.push(`${size.name} signed-in Stop then New chat before cancellation confirmation reports a 409 conflict without constraint mutation or extra SDK calls. Explicit browser refresh then New chat recovers. The signed-in Account sheet has no reload control.`);
      } finally {
        release();
        await context.close();
        await conflictRuntime.close();
      }
    }
    const context = await browser.newContext({ viewport: size });
    const page = await context.newPage();
    await page.goto(runtime.origin);
    await send(page, "Hello");
    await expect(
      page.getByText("Hi. What are you looking to buy?", { exact: true }),
    ).toBeVisible();
    let releaseReset;
    let resetEntered;
    const resetGate = new Promise((resolve) => { releaseReset = resolve; });
    const resetHeld = new Promise((resolve) => { resetEntered = resolve; });
    await page.route("**/api/new-chat", async (route) => {
      const response = await route.fetch();
      resetEntered();
      await resetGate;
      await route.fulfill({ response });
    });
    await page.getByRole("button", { name: "New chat", exact: true }).click();
    await resetHeld;
    const email = `fixture-browser-${randomUUID()}@example.test`;
    await authenticate(page, email, true);
    await expect(
      page.getByRole("heading", {
        name: "What are you looking for?",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Hi. What are you looking to buy?", { exact: true }),
    ).toHaveCount(0);
    await send(page, "hello");
    await expect(page.getByText("Hi. What are you looking to buy?", { exact: true })).toBeVisible();
    const composer = page.getByRole("textbox", { name: "Message", exact: true });
    await composer.fill("Fixture signed-in draft");
    const resetResponse = page.waitForResponse((response) => response.url().endsWith("/api/new-chat"));
    releaseReset();
    await resetResponse;
    await page.unroute("**/api/new-chat");
    await expect(page.getByText("Hi. What are you looking to buy?", { exact: true })).toBeVisible();
    await expect(composer).toHaveValue("Fixture signed-in draft");
    await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeEnabled();
    const afterStaleReset = await page.request.get(`${runtime.origin}/api/account`).then((r) => r.json());
    assert.equal(afterStaleReset.status, "signed-in");
    assert.equal(afterStaleReset.workspace.state.messages.some((message) => message.text === "hello"), true);
    proof.push(`${size.name} delayed guest reset cannot replace the signed-in workspace.`);
    await send(page, "I want to buy a powerbank around $30-40.");
    await page.getByRole("button", { name: "SGD", exact: true }).click();
    await expect(
      page.getByText("Fixture data. Automated test substitute.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Fixture Powerbank Model A", { exact: true }),
    ).toBeInViewport();
    const saved = await page.request
      .get(`${runtime.origin}/api/account`)
      .then((r) => r.json());
    assert.equal(saved.status, "signed-in");
    assert.deepEqual(saved.workspace.state.intent.budget, {
      minimum: 30,
      maximum: 40,
      currency: "SGD",
    });
    await page.screenshot({
      path: `artifacts/fieldnote-v2/accounts/${size.name}-saved-research.png`,
    });
    await page.reload();
    await expect(
      page.getByText("Fixture data. Automated test substitute.", {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Switch to light mode", exact: true })
      .click();
    await page.reload();
    await expect(page.locator("html")).toHaveClass("light");
    const isolated = await browser.newContext({ viewport: size });
    const other = await isolated.newPage();
    await other.goto(runtime.origin);
    await authenticate(
      other,
      `fixture-isolated-${randomUUID()}@example.test`,
      true,
    );
    await expect(
      other.getByRole("heading", {
        name: "What are you looking for?",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      other.getByText("Fixture Powerbank Model A", { exact: true }),
    ).toHaveCount(0);
    await isolated.close();
    if (size.name === "mobile") {
      const before = await page.request
        .get(`${runtime.origin}/api/test-stats`)
        .then((r) => r.json());
      await send(page, "I want a slow fixture powerbank under SGD40");
      await expect(page.getByRole("status")).toContainText(
        "Requesting source-backed research",
      );
      await expect
        .poll(
          async () =>
            (
              await page.request
                .get(`${runtime.origin}/api/test-stats`)
                .then((r) => r.json())
            ).calls,
        )
        .toBe(before.calls + 1);
      await page.getByRole("button", { name: "Account", exact: true }).click();
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await expect(
        page.getByRole("heading", {
          name: "What are you looking for?",
          exact: true,
        }),
      ).toBeVisible();
      await expect
        .poll(
          async () =>
            (
              await page.request
                .get(`${runtime.origin}/api/test-stats`)
                .then((r) => r.json())
            ).closed,
        )
        .toBe(before.closed + 1);
      await authenticate(page, email, false);
      const after = await page.request
        .get(`${runtime.origin}/api/account`)
        .then((r) => r.json());
      assert.equal(
        after.workspace.state.messages.filter((m) => m.research).length,
        1,
      );
      proof.push(
        "Mobile sign-out during actual SDK body consumption aborts the transport, preserves accepted context, and prevents late research publication.",
      );
    }
    await page.getByRole("button", { name: "Account", exact: true }).click();
    await page
      .getByRole("button", { name: "Delete saved data", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm delete saved data", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (
            await page.request
              .get(`${runtime.origin}/api/account`)
              .then((r) => r.json())
          ).workspace.state.messages.length,
      )
      .toBe(0);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.screenshot({
      path: `artifacts/fieldnote-v2/accounts/${size.name}-deleted.png`,
    });
    proof.push(
      `${size.name} UI creates an account, keeps guest messages separate, saves both SGD30-40 bounds and fixture research, restores after refresh, isolates another account and deletes saved shopping data.`,
    );
    await context.close();
  }
  await writeFile(
    "artifacts/fieldnote-v2/accounts/browser.json",
    JSON.stringify(
      {
        status: "passed",
        proof,
        limits: [
          "Actual browser, Hono, Better Auth, PostgreSQL and Exa SDK with an explicit local test substitute.",
          "No live Exa operation or current merchant offer is established.",
          "Author verification. Independent visual and security review remain required.",
        ],
      },
      null,
      2,
    ) + "\n",
  );
  process.stdout.write(proof.join("\n") + "\n");
} finally {
  await browser.close();
  await runtime.close();
}
