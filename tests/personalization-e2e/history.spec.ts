import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  legacyBrowserResponse,
  storedResearchTurn,
} from "../fixtures/research-history/records";
import { register, send, screenshot } from "./helpers";

test("restores unchanged mixed evidence through real account cookies without replaying actions", async ({
  page,
  context,
}) => {
  const pool = new Pool({
    connectionString: process.env.FIELDNOTE_TEST_DATABASE_URL,
  });
  const unexpected: string[] = [];
  await context.route("**/*", (route) => {
    if (
      !["127.0.0.1", "localhost"].includes(
        new URL(route.request().url()).hostname,
      )
    ) {
      unexpected.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  try {
    await page.goto("/");
    await register(page, `mixed-${randomUUID()}@example.test`);
    const account = await (await context.request.get("/api/account")).json();
    const data = (
      await pool.query(
        "SELECT data FROM shopping_workspace WHERE user_id = $1",
        [account.user.id],
      )
    ).rows[0].data;
    const legacy = storedResearchTurn(legacyBrowserResponse);
    data.turns = [legacy];
    await pool.query(
      "UPDATE shopping_workspace SET data = $2::jsonb WHERE user_id = $1",
      [account.user.id, JSON.stringify(data)],
    );
    const commands: string[] = [];
    page.on("request", (request) => {
      if (
        [
          "/api/workspace",
          "/api/turn",
          "/api/research",
          "/api/select",
        ].includes(new URL(request.url()).pathname)
      )
        commands.push(request.url());
    });
    await page.reload();
    await expect(
      page.getByRole("article", {
        name: "Automated fixture headphones",
        exact: true,
      }),
    ).toBeVisible();
    expect(commands).toEqual([]);
    await send(page, "headphones under SGD250");
    await expect(
      page.getByRole("article", {
        name: "Automated fixture identity-only headphones",
        exact: true,
      }),
    ).toBeVisible();
    const saved = (await (await context.request.get("/api/account")).json())
      .workspace;
    expect(saved.turns[0]).toEqual(legacy);
    expect(saved.turns[1].body.value.research.evidenceVersion).toBe(2);
    expect(saved.preferences.hard.budget.amount).toBe(250);
    const ledger = await readFile(process.env.FIELDNOTE_TEST_LEDGER!, "utf8");
    commands.length = 0;
    await page.reload();
    await expect(page.getByTestId("conversation-turn")).toHaveCount(2);
    await expect(
      page.locator('[data-testid="conversation-turn"][data-active="true"]'),
    ).toHaveCount(0);
    expect(commands).toEqual([]);
    const restored = (await (await context.request.get("/api/account")).json())
      .workspace;
    expect(restored).toEqual(saved);
    expect(await readFile(process.env.FIELDNOTE_TEST_LEDGER!, "utf8")).toBe(
      ledger,
    );
    const oldTurn = page.getByTestId("conversation-turn").first();
    const newTurn = page.getByTestId("conversation-turn").last();
    await oldTurn.getByRole("button", { name: "Evidence and limits" }).click();
    await oldTurn.scrollIntoViewIfNeeded();
    await screenshot(page, "mixed-legacy-evidence");
    const card = newTurn.getByRole("article", {
      name: "Automated fixture headphones",
      exact: true,
    });
    await card.getByRole("button", { name: "Evidence and limits" }).click();
    await card.scrollIntoViewIfNeeded();
    await expect(
      card
        .getByText("S$ 249 was S$ 349 SGD You Save S$ 100", { exact: true })
        .first(),
    ).toBeVisible();
    await screenshot(page, "mixed-v2-price-context");
    const identity = newTurn.getByRole("article", {
      name: "Automated fixture identity-only headphones",
      exact: true,
    });
    await identity.getByRole("button", { name: "Evidence and limits" }).click();
    await identity.scrollIntoViewIfNeeded();
    await expect(
      identity.getByText("Specifications not established by this source."),
    ).toBeVisible();
    await screenshot(page, "mixed-v2-identity-only");
    for (const link of await page
      .getByRole("link", { name: /View source/ })
      .all())
      expect(await link.getAttribute("href")).toMatch(
        /^https:\/\/example\.com\/fixture-/,
      );
    await expect(
      page.getByRole("button", { name: /Choose|Search web sources|Retry/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("textbox", { name: "Message", exact: true }),
    ).toBeInViewport();
    expect(commands).toEqual([]);
    await send(page, "thanks");
    await expect(page.getByTestId("conversation-turn")).toHaveCount(3);
    const after = (await (await context.request.get("/api/account")).json())
      .workspace;
    expect(after.turns.slice(0, 2)).toEqual(saved.turns);
    expect(await readFile(process.env.FIELDNOTE_TEST_LEDGER!, "utf8")).toBe(
      ledger,
    );
    expect(unexpected).toEqual([]);
  } finally {
    await pool.end();
  }
});
