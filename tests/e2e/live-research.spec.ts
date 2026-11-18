import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { defaultPreferences } from "../../src/domain/contracts";

const preferences = defaultPreferences();
preferences.hard.category = "headphones";
preferences.hard.budget = { amount: 300, currency: "SGD" };
const quote = "Aster Wave 2 supports wireless audio.";
const price = "Aster Wave 2 is listed at SGD 229.00.";
const snapshot = {
  dataKind: "web-research",
  retrievedAt: "2026-11-18T01:00:00.000Z",
  requestId: "automated-fixture",
  reportedCostUsd: 0.007,
  grounding: [],
  sources: [
    {
      id: "source-1",
      title: "Aster Wave 2 specifications",
      url: "https://reviews.example.com/aster-wave-2",
      highlights: [quote, price],
    },
    {
      id: "source-2",
      title: "Orbit Quiet review",
      url: "https://reviews.example.com/orbit-quiet",
      highlights: ["Orbit Quiet supports wireless audio."],
    },
  ],
  products: [
    {
      id: "research-aster",
      name: "Aster Wave 2",
      facts: [{ sourceId: "source-1", quote }],
      price: {
        kind: "page-observed-unverified",
        sourceId: "source-1",
        quote: price,
      },
      stock: "unverified",
      unresolvedConstraints: [
        "Stock and delivery to SG are unverified",
        "Current affordability within SGD 300 is unverified",
      ],
    },
    {
      id: "research-orbit",
      name: "Orbit Quiet",
      facts: [
        { sourceId: "source-2", quote: "Orbit Quiet supports wireless audio." },
      ],
      price: null,
      stock: "unverified",
      unresolvedConstraints: [
        "Current price, stock and delivery remain unverified",
      ],
    },
  ],
  limitations: [
    "Page observations do not verify current price, stock, delivery or merchant offers.",
  ],
};

test.beforeEach(async ({ page }) => {
  await mkdir("artifacts/playwright-results/live-research", {
    recursive: true,
  });
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: {
        status: "ok",
        mode: "research",
        liveIntegrations: true,
        merchantVerification: "unavailable",
      },
    }),
  );
});

test("shows cited research cards, observed-price uncertainty and readable desktop/mobile history", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/turn", (route) => {
    calls++;
    return route.fulfill({
      json: {
        kind: "research",
        answer:
          "These research leads have source-linked observations. Current prices and stock need verification.",
        preferences,
        notes: [],
        research: snapshot,
      },
    });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.getByText("Web research", { exact: true })).toBeVisible();
  await page
    .getByLabel("Message", { exact: true })
    .fill("Wireless headphones under SGD300");
  await page.getByRole("button", { name: "Send message" }).click();
  const card = page.getByRole("article", { name: "Aster Wave 2" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Page-observed price · Unverified");
  await expect(card).toContainText("Stock unverified");
  await expect(
    page.getByRole("button", { name: "Select this product" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Search the web for context" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Compare research leads" }).click();
  await expect(page.getByRole("table")).toContainText("Orbit Quiet");
  await card.getByRole("button", { name: "Evidence and limits" }).click();
  await expect(card.getByRole("blockquote").first()).toHaveText(quote);
  await expect(
    card.getByRole("link", { name: /View source/ }).first(),
  ).toHaveAttribute("href", "https://reviews.example.com/aster-wave-2");
  await page.screenshot({
    path: "artifacts/playwright-results/live-research/desktop-research.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );
  const dimensions = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
  await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
  await page.screenshot({
    path: "artifacts/playwright-results/live-research/mobile-research.png",
    fullPage: true,
  });
  expect(calls).toBe(1);
  await page.route("**/api/turn", (route) =>
    route.fulfill({
      json: {
        kind: "message",
        message: "You're welcome.",
        preferences,
        notes: [],
        toolActivity: [],
      },
    }),
  );
  await page.getByLabel("Message", { exact: true }).fill("Thanks");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByTestId("conversation-turn")).toHaveCount(2);
  await expect(card).toContainText("Aster Wave 2");
  await expect(page.getByText("You're welcome.")).toBeVisible();
});

test("keeps unavailable research explicit without synthetic results or merchant actions", async ({
  page,
}) => {
  await page.route("**/api/turn", (route) =>
    route.fulfill({
      json: {
        kind: "research-unavailable",
        reason: "quota",
        message:
          "Research is paused by the local usage limit. Your preferences are retained.",
        preferences,
        notes: [],
      },
    }),
  );
  await page.goto("/");
  await page
    .getByLabel("Message", { exact: true })
    .fill("Headphones under SGD300");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByRole("heading", { name: "Research unavailable" }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByText("Sony WH-CH720N")).toHaveCount(0);
  await expect(page.getByText("Fixture data", { exact: true })).toHaveCount(0);
});

test("rejects a research result whose quoted evidence does not exist at its source", async ({
  page,
}) => {
  const forged = structuredClone(snapshot);
  forged.products[0].price!.quote = "Invented current price SGD 1";
  await page.route("**/api/turn", (route) =>
    route.fulfill({
      json: {
        kind: "research",
        answer: "Forged",
        preferences,
        notes: [],
        research: forged,
      },
    }),
  );
  await page.goto("/");
  await page
    .getByLabel("Message", { exact: true })
    .fill("Headphones under SGD300");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("alert")).toContainText("unreadable result");
  await expect(page.getByRole("link", { name: /View source/ })).toHaveCount(0);
});
