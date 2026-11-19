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
  await page
    .getByRole("button", {
      name: register ? "Create account" : "Sign in",
      exact: true,
    })
    .click();
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
    const context = await browser.newContext({ viewport: size });
    const page = await context.newPage();
    await page.goto(runtime.origin);
    await send(page, "Hello");
    await expect(
      page.getByText("Hi. What are you looking to buy?", { exact: true }),
    ).toBeVisible();
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
