import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { register, send, signout, screenshot } from "./helpers";

test("real proxy cookies preserve private history, reset and identity changes across responsive views", async ({
  page,
  context,
}) => {
  const pool = new Pool({
    connectionString: process.env.FIELDNOTE_TEST_DATABASE_URL,
  });
  const emailA = `browser-a-${randomUUID()}@example.test`;
  const emailB = `browser-b-${randomUUID()}@example.test`;
  const unexpected: string[] = [];
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      unexpected.push(url.origin);
      return route.abort();
    }
    return route.continue();
  });
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveClass(/light/);
    await expect(
      page.getByRole("textbox", { name: "Message", exact: true }),
    ).toBeEnabled();
    await send(page, "hello");
    await expect(
      page.getByText(
        "Hi. What are you looking for? I can help compare headphones and laptops.",
      ),
    ).toBeVisible();
    await screenshot(page, "desktop-guest");
    await page.getByRole("button", { name: "Account", exact: true }).click();
    await screenshot(page, "desktop-account-form");
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await register(page, emailA);
    await expect(page.getByText("hello", { exact: true })).not.toBeVisible();
    await send(page, "headphones");
    await expect(
      page.getByRole("button", { name: "Skip budget" }),
    ).toBeVisible();
    await send(page, "under SGD250");
    await expect(
      page.getByText("Automated fixture headphones", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/light/);
    await expect(
      page.getByText("Automated fixture headphones", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Skip budget" }),
    ).not.toBeVisible();
    await screenshot(page, "desktop-restored-history-light");
    const account = await (await context.request.get("/api/account")).json();
    expect(account.workspace.preferences.hard.budget.amount).toBe(250);
    const userA = account.user.id;
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(
      (cookie) => cookie.name === "fieldnote.session_token",
    )!;
    expect(sessionCookie.httpOnly).toBe(true);
    expect(sessionCookie.sameSite).toBe("Lax");
    expect(sessionCookie.domain).toBe("127.0.0.1");

    const tab = await context.newPage();
    await tab.goto("/");
    await expect(
      tab.getByText("Automated fixture headphones", { exact: true }),
    ).toBeVisible();
    await signout(page);
    await expect(
      tab.getByText("Automated fixture headphones", { exact: true }),
    ).not.toBeVisible();
    await register(page, emailB);
    await expect(
      page.getByText("Automated fixture headphones", { exact: true }),
    ).not.toBeVisible();
    await screenshot(page, "desktop-account-switch");
    await send(page, "hello");
    await expect(
      page.getByText(
        "Hi. What are you looking for? I can help compare headphones and laptops.",
      ),
    ).toBeVisible();
    const rowA = (
      await pool.query(
        "SELECT data FROM shopping_workspace WHERE user_id = $1",
        [userA],
      )
    ).rows[0].data;
    expect(rowA.turns).toHaveLength(2);
    await signout(page);
    await page.getByRole("button", { name: "Account", exact: true }).click();
    await page.getByLabel("Email", { exact: true }).fill(emailA);
    await page
      .getByLabel("Password", { exact: true })
      .fill("fixture-browser-password-only");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByText("Automated fixture headphones", { exact: true }),
    ).toBeVisible();
    await tab.close();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await screenshot(page, "mobile-restored-history-dark");
    await page.getByRole("button", { name: "Account", exact: true }).click();
    await screenshot(page, "mobile-account-data");
    await page
      .getByRole("button", { name: "Delete saved data", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm delete saved data", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Delete saved data", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(
      page.getByText("Automated fixture headphones", { exact: true }),
    ).not.toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "What are you looking for?" }),
    ).toBeVisible();
    await screenshot(page, "mobile-deleted");
    expect(
      (
        await pool.query(
          "SELECT data FROM shopping_workspace WHERE user_id = $1",
          [userA],
        )
      ).rows[0].data.turns,
    ).toEqual([]);

    await send(page, "headphones under SGD201");
    await expect(
      page.getByRole("button", { name: "Stop response" }),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          (
            await pool.query(
              "SELECT data FROM shopping_workspace WHERE user_id = $1",
              [userA],
            )
          ).rows[0].data.pending,
      )
      .not.toBeNull();
    await page.getByRole("button", { name: "New chat", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "What are you looking for?" }),
    ).toBeVisible();
    await page.waitForTimeout(2200);
    await expect(
      page.getByText("Automated fixture headphones", { exact: true }),
    ).not.toBeVisible();
    expect(
      (
        await pool.query(
          "SELECT data FROM shopping_workspace WHERE user_id = $1",
          [userA],
        )
      ).rows[0].data.turns,
    ).toEqual([]);
    await screenshot(page, "mobile-reset-late-response");
    await page.getByRole("button", { name: "Account", exact: true }).click();
    await page.route("**/api/auth/sign-out", (route) =>
      route.fulfill({
        status: 503,
        json: { error: "fixture signout failure" },
      }),
    );
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(
      page
        .getByRole("dialog")
        .getByText("Sign-out did not complete. Try again."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeVisible();
    await page.unroute("**/api/auth/sign-out");
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.route("**/api/account", (route) =>
      route.fulfill({ status: 503, json: { status: "unavailable" } }),
    );
    await page.reload();
    await page.getByRole("button", { name: "Account", exact: true }).click();
    await expect(
      page.getByText(
        "Account persistence is unavailable. Reload the account connection before continuing.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("dialog").getByText(/unavailable/)).toHaveCount(
      1,
    );
    await screenshot(page, "mobile-persistence-unavailable");
    expect(unexpected).toEqual([]);
  } finally {
    await pool.end();
  }
});
