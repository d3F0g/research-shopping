import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test("opens a minimal dark chat even when the system prefers light", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(
    page.getByRole("heading", { name: "What are you looking for?" }),
  ).toBeVisible();
  await expect(page.getByRole("complementary")).toHaveCount(0);
  await expect(page.locator(".product-card")).toHaveCount(0);
  await expect(page.getByLabel("Message", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight),
  ).toBeLessThanOrEqual(900);
});

test("keeps both exchanges when a natural followup changes the budget", async ({
  page,
}) => {
  await page.goto("/");
  const composer = page.getByLabel("Message", { exact: true });
  await composer.fill("Headphones under SGD500");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.locator('[data-active="true"] .product-card')).toHaveCount(
    3,
  );
  await composer.fill("under SGD200");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByTestId("conversation-turn")).toHaveCount(2);
  await expect(page.getByTestId("user-message").first()).toContainText(
    "Headphones under SGD500",
  );
  await expect(page.getByTestId("assistant-message").first()).toContainText(
    "leading sample match",
  );
  await expect(page.locator('[data-active="true"] .product-card')).toHaveCount(
    1,
  );
  await expect(
    page.locator('[data-testid="conversation-turn"][data-active="true"]'),
  ).toContainText("S$149");
  await expect(
    page
      .getByTestId("conversation-turn")
      .first()
      .getByRole("button", { name: "Select this product" }),
  ).toHaveCount(0);
});

test("persists the chosen theme and defaults to dark for invalid storage", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).toHaveClass(/light/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/light/);
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.evaluate(() =>
    localStorage.setItem("fieldnote-theme", "unexpected"),
  );
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("shows ordinary replies and contextual questions without inventing activity", async ({
  page,
}) => {
  await page.goto("/");
  const send = async (text: string) => {
    await page.getByLabel("Message", { exact: true }).fill(text);
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
  };
  await send("Hi");
  await expect(page.getByTestId("assistant-message")).toContainText(
    "Hi. What are you looking for?",
  );
  await expect(
    page.locator(".question-card, .product-card, .tool-activity"),
  ).toHaveCount(0);
  await send("Something nice");
  await page.getByRole("button", { name: "Headphones", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Any budget in mind?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Skip budget", exact: true }).click();
  await expect(
    page.locator(
      '[data-testid="conversation-turn"][data-active="true"] .product-card',
    ),
  ).toHaveCount(3);
  await send("prefer battery");
  await expect(
    page.locator(
      '[data-testid="conversation-turn"][data-active="true"] .product-card',
    ),
  ).toHaveCount(3);
  await expect(
    page.getByRole("heading", { name: "Any budget in mind?" }),
  ).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Skip budget" })).toHaveCount(
    0,
  );
  await expect(page.getByTestId("conversation-turn")).toHaveCount(5);
});

test("validates custom budget replies and does not ask for known preferences", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Message", { exact: true }).fill("Headphones");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.getByLabel("Budget amount", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Apply budget" }).click();
  await expect(page.getByRole("alert")).toContainText("positive amount");
  await expect(page.locator(".product-card")).toHaveCount(0);
  await page.getByLabel("Budget amount", { exact: true }).fill("200");
  await page.getByRole("button", { name: "Apply budget" }).click();
  await expect(
    page.locator(
      '[data-testid="conversation-turn"][data-active="true"] .product-card',
    ),
  ).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Skip budget" })).toHaveCount(
    0,
  );
  await page.getByLabel("Message", { exact: true }).fill("what about laptops?");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByTestId("conversation-turn").last()).toContainText(
    "No sample option meets these limits",
  );
  await expect(page.getByTestId("conversation-turn").last()).not.toContainText(
    "Any budget in mind?",
  );
});

test("keeps unsupported requirements through acknowledgments and category changes", async ({
  page,
}) => {
  await page.goto("/");
  for (const message of [
    "headphones must be waterproof",
    "yes",
    "what about laptops?",
  ]) {
    await page.getByLabel("Message", { exact: true }).fill(message);
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(
      page
        .getByTestId("conversation-turn")
        .last()
        .locator('[data-testid="assistant-message"]'),
    ).toContainText(/requirement|request/);
  }
  await expect(page.locator(".product-card")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Skip budget" })).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Edit preferences", exact: true })
    .click();
  await expect(
    page.getByText("headphones must be waterproof", { exact: true }),
  ).toHaveCount(2);
});

test("stops an actual pending response and retries the same user turn", async ({
  page,
}) => {
  let start!: () => void;
  let release!: () => void;
  const started = new Promise<void>((resolve) => {
    start = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await page.route("**/api/turn", async (route) => {
    if (++calls > 1) return route.continue();
    start();
    await held;
    await route.abort().catch(() => undefined);
  });
  await page.goto("/");
  await page
    .getByLabel("Message", { exact: true })
    .fill("Headphones under SGD200");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await started;
  const cancelled = page.waitForEvent("requestfailed", (request) =>
    request.url().endsWith("/api/turn"),
  );
  await page.getByRole("button", { name: "Stop response" }).click();
  await cancelled;
  await expect(
    page.getByText("Response stopped.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop response" })).toHaveCount(
    0,
  );
  release();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(1);
  await expect(page.getByTestId("conversation-turn")).toHaveCount(1);
  expect(calls).toBe(2);
});

test("revokes historical merchant links when a draft changes", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Message", { exact: true })
    .fill("Headphones under SGD200");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.getByRole("button", { name: "Select this product" }).click();
  await expect(
    page.getByRole("link", { name: /Open manufacturer product page/ }),
  ).toBeVisible();
  await page.getByLabel("Message", { exact: true }).fill("under SGD100");
  await expect(
    page.getByRole("link", { name: /Open manufacturer product page/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Select this product" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Search the web for context" }),
  ).toHaveCount(0);
  await expect(page.getByText(/Earlier product destination/)).toBeVisible();
  await expect(page.locator(".product-card")).toHaveCount(1);
});

test("keeps the mobile composer visible while reading earlier messages and using disclosures", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const composer = page.getByLabel("Message", { exact: true });
  for (const message of ["Headphones under SGD500", "under SGD200", "why?"]) {
    await composer.fill(message);
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(
      page
        .getByTestId("conversation-turn")
        .last()
        .getByTestId("assistant-message"),
    ).not.toContainText("Waiting for");
    await expect(page.getByTestId("conversation-turn").last()).toHaveAttribute(
      "data-active",
      "true",
    );
  }
  const viewport = page.getByLabel("Conversation history");
  const assertComposer = async () => {
    const box = await composer.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThan(56);
    expect(box!.y + box!.height).toBeLessThan(844);
    expect(
      await composer.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      ),
    ).toBeGreaterThanOrEqual(16);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBe(844);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(390);
  };
  await assertComposer();
  const viewportBox = await viewport.boundingBox();
  await page.mouse.move(
    viewportBox!.x + viewportBox!.width / 2,
    viewportBox!.y + 200,
  );
  await page.mouse.wheel(0, -10000);
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollTop))
    .toBe(0);
  await expect(page.getByTestId("user-message").first()).toBeInViewport();
  await assertComposer();
  const evidence = page
    .getByTestId("conversation-turn")
    .first()
    .getByRole("button", { name: "Evidence and limits" })
    .first();
  await evidence.click();
  await expect(
    page.getByText("CONFLICTING SAMPLE CLAIMS", { exact: true }),
  ).toBeVisible();
  const firstCard = page
    .getByTestId("conversation-turn")
    .first()
    .locator(".product-card")
    .first();
  const cardBox = await firstCard.boundingBox();
  const detailBox = await firstCard
    .locator('[data-slot="trace-collapsible-content"]')
    .boundingBox();
  expect(detailBox!.width).toBeGreaterThan(cardBox!.width * 0.8);
  const citation = firstCard
    .getByRole("button", { name: /Preview reference/ })
    .first();
  const reference = firstCard
    .getByRole("link", { name: /Manufacturer reference/ })
    .first();
  for (const target of [citation, reference]) {
    const box = await target.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  await assertComposer();
  await evidence.click();
  await page.getByRole("button", { name: "Scroll to latest message" }).click();
  await expect(
    page
      .getByTestId("conversation-turn")
      .last()
      .getByTestId("assistant-message"),
  ).toBeInViewport();
  await assertComposer();
});

test("aborts source transport on a draft edit and selection transport on reset", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Message", { exact: true })
    .fill("Headphones under SGD200");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  for (const endpoint of ["research", "select"]) {
    let start!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      start = resolve;
    });
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(`**/api/${endpoint}`, async (route) => {
      start();
      await held;
      await route.abort().catch(() => undefined);
    });
    await page
      .getByRole("button", {
        name:
          endpoint === "research"
            ? "Search the web for context"
            : "Select this product",
      })
      .click();
    await started;
    const aborted = page.waitForEvent("requestfailed", (request) =>
      request.url().endsWith(`/api/${endpoint}`),
    );
    if (endpoint === "research")
      await page.getByLabel("Message", { exact: true }).fill("under SGD200");
    else await page.getByRole("button", { name: "New chat" }).click();
    await aborted;
    release();
    if (endpoint === "research") {
      await expect(page.getByText("Web research stopped.")).toBeVisible();
      await expect(
        page.getByText("Searching sources for this shortlist…"),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Send message", exact: true })
        .click();
      await expect(
        page.getByTestId("conversation-turn").last(),
      ).toHaveAttribute("data-active", "true");
    }
  }
  await expect(page.getByTestId("conversation-turn")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /Open manufacturer product page/ }),
  ).toHaveCount(0);
});

test("expands current product evidence across the mobile card with usable touch targets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByLabel("Message", { exact: true })
    .fill("Headphones under SGD200");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  const card = page
    .getByTestId("conversation-turn")
    .last()
    .locator(".product-card")
    .first();
  await card.getByRole("button", { name: "Evidence and limits" }).click();
  await expect(
    card.getByText("CONFLICTING SAMPLE CLAIMS", { exact: true }),
  ).toBeVisible();
  const metrics = await card.evaluate((element) => {
    const content = element.querySelector(
      '[data-slot="trace-collapsible-content"]',
    )!;
    return {
      cardWidth: element.getBoundingClientRect().width,
      evidenceWidth: content.getBoundingClientRect().width,
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
    };
  });
  await test.info().attach("evidence-widths", {
    body: JSON.stringify(metrics),
    contentType: "application/json",
  });
  await page.screenshot({
    path: "artifacts/chat-first/application/evidence-mobile-final.png",
    animations: "disabled",
  });
  await writeFile(
    "artifacts/chat-first/application/evidence-widths-final.json",
    JSON.stringify(metrics, null, 2),
  );
  expect(metrics.evidenceWidth).toBeGreaterThan(metrics.cardWidth * 0.8);
  expect(metrics.documentWidth).toBe(metrics.viewportWidth);
  for (const target of [
    card.getByRole("button", { name: /Preview reference/ }).first(),
    card.getByRole("link", { name: /Manufacturer reference/ }).first(),
  ]) {
    const box = await target.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
});

test("does not ask for an optional cap after an explicit budget removal", async ({
  page,
}) => {
  await page.goto("/");
  for (const message of [
    "Headphones under SGD200",
    "remove the budget limit",
  ]) {
    await page.getByLabel("Message", { exact: true }).fill(message);
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(page.getByTestId("conversation-turn").last()).toHaveAttribute(
      "data-active",
      "true",
    );
  }
  await expect(
    page.getByTestId("conversation-turn").last().locator(".product-card"),
  ).toHaveCount(3);
  await expect(
    page.getByRole("heading", { name: "Any budget in mind?" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "New chat" }).click();
  await page
    .getByLabel("Message", { exact: true })
    .fill("Headphones no budget limit");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Skip budget" })).toHaveCount(
    0,
  );
});
