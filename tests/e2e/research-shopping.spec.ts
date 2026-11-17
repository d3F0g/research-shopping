import { mkdir } from "node:fs/promises";
import { expect, test, type Page, type Route } from "@playwright/test";

async function researchWithPrompt(page: Page, prompt: string) {
  await page.goto("/");
  await page.getByLabel("Start with the outcome, not a model number.").fill(prompt);
  await page.getByRole("button", { name: "Research options" }).click();
  await expect(page.getByRole("heading", { name: "Your shortlist" })).toBeVisible();
}

async function assertNoHorizontalOverflow(page: Page) {
  const width = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(width.document).toBeLessThanOrEqual(width.viewport);
  expect(width.body).toBeLessThanOrEqual(width.viewport);
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve: () => resolve() };
}

function webResearchResponse(overrides: Record<string, unknown> = {}) {
  return {
    status: "ready",
    retrievedAt: "2026-11-18T04:00:00.000Z",
    results: [{
      title: "Reference source",
      url: "https://www.example.org/product-review",
      highlights: ["A plain text excerpt."],
    }],
    truncated: false,
    ...overrides,
  };
}

async function holdResponse(route: Route, started: ReturnType<typeof deferred>, release: ReturnType<typeof deferred>, finished: ReturnType<typeof deferred>) {
  started.resolve();
  try {
    const response = await route.fetch();
    await release.promise;
    await route.fulfill({ response }).catch(() => undefined);
  } catch {
    await route.abort().catch(() => undefined);
  } finally {
    finished.resolve();
  }
}

type HandoffPatch = Partial<{
  productId: string;
  productName: string;
  productUrl: string;
  offer: Partial<{ productId: string; productUrl: string; merchantHost: string }>;
}>;

async function fulfillAlteredSelection(route: Route, patch: HandoffPatch) {
  const response = await route.fetch();
  const payload = await response.json() as {
    productId: string;
    productName: string;
    productUrl: string;
    offer: { productId: string; productUrl: string; merchantHost: string };
  };
  const { offer, ...productPatch } = patch;
  Object.assign(payload, productPatch);
  if (offer) Object.assign(payload.offer, offer);
  await route.fulfill({ response, body: JSON.stringify(payload) });
}

test("compares fixture headphones, shows evidence and hands off through the selected product ID", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("button", { name: /Wireless headphones for long flights/ }).click();
  await expect(page.getByRole("heading", { name: "Your shortlist" })).toBeVisible();
  await expect(page.getByText("Sample price · fixture only").first()).toBeVisible();
  await expect(page.getByText("Synthetic development samples.")).toBeVisible();
  await expect(page.locator(".product-card")).toHaveCount(3);
  await expect(page.locator(".product-grid")).not.toContainText("ATH-M50xBT2");
  await expect(page.getByLabel("Start with the outcome, not a model number.")).toHaveValue("");

  const sony = page.locator(".product-card").filter({ hasText: "Sony WH-CH720N" });
  await sony.getByText("Evidence and limits").click();
  await expect(sony.getByText("CONFLICTING SAMPLE CLAIMS", { exact: true })).toBeVisible();
  await expect(sony.getByText("Synthetic fixture timestamp · 15 Jan 2025").first()).toBeVisible();
  const sourceLink = sony.getByRole("link", { name: /Manufacturer reference\/model page/ }).first();
  await expect(sourceLink).toHaveAttribute("href", "https://www.sony.com.sg/headphones/products/wh-ch720n");
  await expect(sourceLink).toHaveAttribute("target", "_blank");
  await expect(sourceLink).toHaveAttribute("rel", /noopener/);

  await mkdir("artifacts/screenshots", { recursive: true });
  await page.screenshot({ path: "artifacts/screenshots/shortlist-desktop.png", fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: "artifacts/screenshots/shortlist-mobile.png", fullPage: true, animations: "disabled" });

  await sony.getByRole("button", { name: "Select this product" }).click();
  await expect(page.getByRole("heading", { name: "Sony WH-CH720N" })).toBeVisible();
  const merchantLink = page.getByRole("link", { name: /Open manufacturer product page/ });
  await expect(merchantLink).toHaveAttribute("href", "https://www.sony.com.sg/headphones/products/wh-ch720n");
  await expect(merchantLink).toHaveAttribute("rel", /noopener/);
  await expect(page.getByText("Sample price · fixture only")).toBeVisible();
  await assertNoHorizontalOverflow(page);
});

test("shows and removes the starter portability priority without changing hard constraints", async ({ page }) => {
  const payloads: { preferences: { hard: { category: string | null; budget: { amount: number; currency: string } | null; region: string; requiredFeatures: string[] }; soft: { priorities: string[] } } }[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/turn") && request.method() === "POST") payloads.push(request.postDataJSON() as typeof payloads[number]);
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Wireless headphones for long flights/ }).click();
  const portability = page.getByRole("checkbox", { name: "Portability", exact: true });
  await expect(portability).toBeChecked();
  const portabilityRow = portability.locator("xpath=ancestor::*[@data-slot='field'][1]");
  await expect(portabilityRow.getByLabel("Priority 1")).toBeVisible();
  await mkdir("artifacts/frontend-standard/priority", { recursive: true });
  await page.screenshot({ path: "artifacts/frontend-standard/priority/headphone-priority.png", fullPage: true, animations: "disabled" });

  await portability.uncheck();
  await page.getByRole("button", { name: "Update comparison" }).click();
  await expect.poll(() => payloads.at(-1)?.preferences.soft.priorities).not.toContain("portability");
  expect(payloads.at(-1)?.preferences.hard).toMatchObject({
    category: "headphones",
    budget: { amount: 500, currency: "SGD" },
    region: "SG",
    requiredFeatures: ["wireless"],
  });
});

test("shows a visible focus indicator while tabbing to the request field", async ({ page }) => {
  await page.goto("/");
  const request = page.getByLabel("Start with the outcome, not a model number.");
  let focusedRequest = false;
  for (let tab = 0; tab < 30 && !focusedRequest; tab += 1) {
    await page.keyboard.press("Tab");
    focusedRequest = await request.evaluate((element) => document.activeElement === element);
  }
  expect(focusedRequest).toBe(true);
  await expect(request).toBeFocused();
  const focusStyle = await request.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  expect(focusStyle.outlineStyle).toBe("solid");
  expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThanOrEqual(3);
});

test("keeps the prior budget while an invalid draft is visible and applies a lower cap without replaying the old request", async ({ page }) => {
  const payloads: { message: string; preferences: { hard: { budget: { amount: number; currency: string } | null } } }[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/turn") && request.method() === "POST") payloads.push(request.postDataJSON() as typeof payloads[number]);
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Wireless headphones for long flights/ }).click();
  const budget = page.getByLabel("Maximum budget amount");
  await expect(budget).toHaveValue("500");

  await budget.fill("0");
  await expect(page.getByRole("alert").filter({ hasText: "Enter a positive amount" })).toBeVisible();
  await expect(budget).toHaveValue("0");
  await expect(page.getByRole("button", { name: "Update shortlist" })).toBeDisabled();

  await budget.fill("100");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Update comparison" }).click();
  await expect(page.getByRole("heading", { name: "No sample option meets these limits" })).toBeVisible();
  expect(payloads.at(-1)?.message).toBe("Show options");
  expect(payloads.at(-1)?.preferences.hard.budget).toEqual({ amount: 100, currency: "SGD" });
  await expect(page.locator(".product-card")).toHaveCount(0);
});

test("moves a selected flexible priority ahead of price and changes the leading match", async ({ page }) => {
  await researchWithPrompt(page, "Headphones under S$400");
  await expect(page.locator(".product-card").first()).toContainText("Sony WH-CH720N");
  await page.getByRole("checkbox", { name: "Battery", exact: true }).check();
  await expect(page.getByText("The most recently selected priority has the most influence.")).toBeVisible();
  await page.getByRole("button", { name: "Update comparison" }).click();
  await expect(page.locator(".product-card").first()).toContainText("MOMENTUM 4 Wireless");
});

test("does not convert a budget across regions, adapts answer length, and honors no budget limit", async ({ page }) => {
  await researchWithPrompt(page, "Headphones under S$400");
  const budget = page.getByLabel("Maximum budget amount");
  await expect(budget).toHaveValue("400");
  await page.getByLabel("Offer region").selectOption("US");
  await page.getByRole("button", { name: "Update comparison" }).click();
  await expect(page.getByRole("heading", { name: "No sample option meets these limits" })).toBeVisible();
  await expect(page.getByText(/No regional offer or currency conversion/)).toBeVisible();

  await page.getByLabel("Offer region").selectOption("SG");
  await page.getByRole("button", { name: "Update comparison" }).click();
  await expect(page.getByRole("heading", { name: "Your shortlist" })).toBeVisible();
  await page.getByLabel("Answer length").selectOption("expanded");
  await page.getByRole("button", { name: "Update comparison" }).click();
  await expect(page.getByText(/Ranking follows your supported priorities, then sample price/)).toBeVisible();

  await page.getByLabel("Start with the outcome, not a model number.").fill("no budget limit");
  await page.getByRole("button", { name: "Research options" }).click();
  await expect(page.getByRole("heading", { name: "Your shortlist" })).toBeVisible();
  await expect(budget).toHaveValue("");
});

test("asks for the product category when the request is ambiguous", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Start with the outcome, not a model number.").fill("Something nice");
  await page.getByRole("button", { name: "Research options" }).click();
  await expect(page.getByRole("heading", { name: "One thing to clarify" })).toBeVisible();
  await expect(page.locator(".clarification-panel")).toContainText("headphones or a laptop");
  await expect(page.getByText("Unresolved hard requirement")).toHaveCount(0);
  await expect(page.locator(".product-card")).toHaveCount(0);
});

test("clears incompatible preferences on category change and holds unsupported hard requirements until dropped", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Product type").selectOption("headphones");
  await expect(page.getByLabel("Product type")).toHaveValue("headphones");
  await page.getByRole("checkbox", { name: "Active noise cancelling" }).check();
  await page.getByRole("checkbox", { name: "Comfort" }).check();
  await page.getByLabel("Product type").selectOption("laptops");
  await expect(page.getByRole("status")).toContainText("active noise cancelling, comfort priority");
  await expect(page.getByRole("checkbox", { name: "OLED display" })).not.toBeChecked();

  await page.getByLabel("Start with the outcome, not a model number.").fill("A laptop with an OLED screen under SGD2000");
  await page.getByRole("button", { name: "Research options" }).click();
  await expect(page.getByRole("heading", { name: "Your shortlist" })).toBeVisible();
  await expect(page.locator(".product-card")).toHaveCount(1);
  await expect(page.locator(".product-card").first()).toContainText("Zenbook 14 OLED");
  await expect(page.getByLabel("Start with the outcome, not a model number.")).toHaveValue("");

  await page.getByLabel("Start with the outcome, not a model number.").fill("A laptop that must be waterproof");
  await page.getByRole("button", { name: "Research options" }).click();
  await expect(page.getByText("Unresolved hard requirement")).toBeVisible();
  await expect(page.getByRole("heading", { name: "One thing to clarify" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Update comparison" })).toBeVisible();
  await page.getByRole("button", { name: "Drop this requirement" }).click();
  await page.getByRole("button", { name: "Update comparison" }).click();
  await expect(page.getByRole("heading", { name: "Your shortlist" })).toBeVisible();
  await expect(page.getByText("Unresolved hard requirement")).toHaveCount(0);
});

test("keeps browser contexts separate and resets their preferences", async ({ browser }) => {
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();
  await Promise.all([firstPage.goto("/"), secondPage.goto("/")]);
  await firstPage.getByLabel("Offer region").selectOption("US");
  await firstPage.getByLabel("Brands to exclude").fill("Bose, Sony");
  await expect(firstPage.getByLabel("Brands to exclude")).toHaveValue("Bose, Sony");
  await expect(secondPage.getByLabel("Offer region")).toHaveValue("SG");
  await expect(secondPage.getByLabel("Brands to exclude")).toHaveValue("");
  await firstPage.getByRole("button", { name: "Reset session" }).click();
  await expect(firstPage.getByLabel("Offer region")).toHaveValue("SG");
  await expect(firstPage.getByLabel("Brands to exclude")).toHaveValue("");
  await firstContext.close();
  await secondContext.close();
});

test("does not let a late result overwrite a newer request", async ({ page }) => {
  const started = deferred();
  const release = deferred();
  const finished = deferred();
  let delayed = true;
  await page.route("**/api/turn", async (route) => {
    if (!delayed) return route.continue();
    delayed = false;
    await holdResponse(route, started, release, finished);
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Wireless headphones for long flights/ }).click();
  await started.promise;
  await page.getByRole("button", { name: "Example requests", exact: true }).click();
  await page.getByRole("button", { name: /A light laptop for writing and travel/ }).click();
  await expect(page.getByRole("heading", { name: "Your shortlist" })).toBeVisible();
  await expect(page.locator(".product-card").first()).toContainText("ASUS");
  release.resolve();
  await finished.promise;
  await expect(page.locator(".product-card").first()).toContainText("ASUS");
  await expect(page.getByRole("heading", { name: "Sony WH-CH720N" })).toHaveCount(0);
});

for (const testCase of [
  {
    title: "a different product ID with its valid catalog destination",
    patch: {
      productId: "sony-wh-1000xm5",
      productName: "Sony WH-1000XM5",
      productUrl: "https://www.sony.com.sg/electronics/headband-headphones/wh-1000xm5",
      offer: {
        productId: "sony-wh-1000xm5",
        productUrl: "https://www.sony.com.sg/electronics/headband-headphones/wh-1000xm5",
        merchantHost: "www.sony.com.sg",
      },
    },
  },
  {
    title: "the selected product ID with an invented approved-host path",
    patch: {
      productUrl: "https://www.sony.com.sg/approved-host-but-invented-path",
      offer: { productUrl: "https://www.sony.com.sg/approved-host-but-invented-path" },
    },
  },
  {
    title: "the selected product with a mismatched merchant host",
    patch: { offer: { merchantHost: "www.dell.com" } },
  },
  {
    title: "the selected product ID and URL with a mismatched catalog name",
    patch: { productName: "Sony Headphones" },
  },
]) {
  test(`rejects a successful handoff response containing ${testCase.title}`, async ({ page }) => {
    await researchWithPrompt(page, "Headphones under S$400");
    await page.route("**/api/select", (route) => fulfillAlteredSelection(route, testCase.patch));
    await page.locator(".product-card").first().getByRole("button", { name: "Select this product" }).click();
    await expect(page.getByRole("alert")).toContainText("unsafe product link");
    await expect(page.getByRole("link", { name: /Open manufacturer product page/ })).toHaveCount(0);
  });
}

test("cancels a pending selection when the user types a new request or resets", async ({ page }) => {
  const firstStarted = deferred();
  const firstRelease = deferred();
  const firstFinished = deferred();
  const secondStarted = deferred();
  const secondRelease = deferred();
  const secondFinished = deferred();
  let selectionCount = 0;
  await page.goto("/");
  await page.getByRole("button", { name: /Wireless headphones for long flights/ }).click();
  await expect(page.getByRole("heading", { name: "Your shortlist" })).toBeVisible();
  await page.route("**/api/select", async (route) => {
    if (selectionCount++ === 0) return holdResponse(route, firstStarted, firstRelease, firstFinished);
    return holdResponse(route, secondStarted, secondRelease, secondFinished);
  });
  await page.locator(".product-card").first().getByRole("button", { name: "Select this product" }).click();
  await firstStarted.promise;
  await expect(page.getByRole("button", { name: "Checking sample link…" })).toBeVisible();
  await page.getByLabel("Start with the outcome, not a model number.").fill("A laptop under SGD2000");
  await page.getByRole("button", { name: "Research options" }).click();
  await expect(page.locator(".product-card").first()).toContainText("ASUS");
  firstRelease.resolve();
  await firstFinished.promise;
  await expect(page.getByRole("heading", { name: "ASUS Zenbook 14 OLED UX3405" })).toHaveCount(1);

  await page.locator(".product-card").first().getByRole("button", { name: "Select this product" }).click();
  await secondStarted.promise;
  await expect(page.getByRole("button", { name: "Checking sample link…" })).toBeVisible();
  await page.getByRole("button", { name: "Reset session" }).click();
  await expect(page.getByLabel("Product type")).toHaveValue("");
  secondRelease.resolve();
  await secondFinished.promise;
  await expect(page.getByRole("heading", { name: "ASUS Zenbook 14 OLED UX3405" })).toHaveCount(0);
  await expect(page.getByText("A useful answer, with the trade-offs close by.")).toBeVisible();
});

test("recovers from an interrupted request without discarding the typed request", async ({ page }) => {
  await page.goto("/");
  await page.route("**/api/turn", (route) => route.abort());
  const request = page.getByLabel("Start with the outcome, not a model number.");
  await request.fill("Headphones under S$400");
  await page.getByRole("button", { name: "Research options" }).click();
  await expect(page.getByRole("alert")).toContainText("Research could not finish");
  await expect(request).toHaveValue("Headphones under S$400");
  await page.unroute("**/api/turn");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("heading", { name: "Your shortlist" })).toBeVisible();
  await expect(request).toHaveValue("");
});

test("opens mobile filters with one labeled editor, traps focus, and returns focus on close", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: /Filters and preferences/ });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Your filters" });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel("Product type")).toHaveCount(1);
  await dialog.getByLabel("Product type").selectOption("headphones");
  await dialog.getByLabel("Maximum budget amount").fill("400");
  await dialog.getByRole("checkbox", { name: "Wireless", exact: true }).check();
  for (let index = 0; index < 25; index += 1) {
    await page.keyboard.press("Tab");
    await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await dialog.getByLabel("Maximum budget amount").scrollIntoViewIfNeeded();
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: "artifacts/screenshots/filters-mobile.png", fullPage: true, animations: "disabled" });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.getByRole("button", { name: "Research options" }).click();
  await expect(page.locator(".product-card").first()).toContainText("Sony WH-CH720N");
  await trigger.click();
  await dialog.getByLabel("Maximum budget amount").fill("100");
  await dialog.getByRole("button", { name: "Update comparison" }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("heading", { name: "No sample option meets these limits" })).toBeVisible();
});

test("opens comparison and source disclosures with keyboard and touch-sized controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await researchWithPrompt(page, "Headphones under S$400");
  const comparison = page.getByRole("button", { name: /Compare .* sample options/ });
  await comparison.focus();
  await page.keyboard.press("Enter");
  await expect(comparison).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("table")).toContainText("Sony WH-CH720N");
  await expect(page.getByRole("table")).toContainText("In stock in fixture");
  const sony = page.getByRole("article", { name: "Sony WH-CH720N", exact: true });
  await sony.getByRole("button", { name: "Evidence and limits" }).click();
  await expect(sony.getByText("UNKNOWN", { exact: true }).first()).toBeVisible();
  await expect(sony.getByText("CONFLICTING SAMPLE CLAIMS", { exact: true })).toBeVisible();
  await sony.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)));
  await sony.getByRole("button", { name: /Preview reference/ }).first().hover();
  const preview = page.locator('[data-slot="hover-card-content"]');
  await expect(preview).toContainText("This page does not verify the sample claim");
  await expect(preview.getByRole("link")).toHaveAttribute("href", "https://www.sony.com.sg/headphones/products/wh-ch720n");
  await page.screenshot({ path: "artifacts/screenshots/citation-desktop.png", fullPage: true, animations: "disabled" });
  await page.mouse.move(0, 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(sony.getByRole("link", { name: /Manufacturer reference\/model page/ }).first()).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await comparison.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "artifacts/screenshots/comparison-mobile.png", fullPage: true, animations: "disabled" });
  await comparison.click();
  await expect(comparison).toHaveAttribute("aria-expanded", "false");
});

test("shows only recorded activity after a response and clears it for clarification", async ({ page }) => {
  const started = deferred();
  const release = deferred();
  const finished = deferred();
  await page.route("**/api/turn", (route) => holdResponse(route, started, release, finished));
  await page.goto("/");
  await page.getByRole("button", { name: /Wireless headphones for long flights/ }).click();
  await started.promise;
  await expect(page.getByRole("status")).toContainText("The sample service has not returned a response yet.");
  await expect(page.getByRole("button", { name: /Recorded activity/ })).toHaveCount(0);
  await page.screenshot({ path: "artifacts/screenshots/request-pending.png", fullPage: true, animations: "disabled" });
  const responsePromise = page.waitForResponse("**/api/turn");
  release.resolve();
  await finished.promise;
  const payload = await (await responsePromise).json() as { toolActivity: { provider: string; outcome: string }[] };
  expect(payload.toolActivity.length).toBeGreaterThan(0);
  await page.getByRole("button", { name: `Recorded activity · ${payload.toolActivity.length} outcomes` }).click();
  const rows = page.locator('.tool-activity [data-slot="trace-collapsible-content"] [data-slot="trace-line"]');
  await expect(rows).toHaveCount(payload.toolActivity.length);
  const providerNames: Record<string, string> = { discovery: "Catalog discovery", research: "Fixture research", merchant: "Sample offer check" };
  const outcomeNames: Record<string, string> = { ok: "Completed", failed: "Failed", timeout: "Timed out" };
  for (const [index, event] of payload.toolActivity.entries()) {
    await expect(rows.nth(index)).toHaveText(`${providerNames[event.provider]} · ${outcomeNames[event.outcome]}`);
  }
  await page.unroute("**/api/turn");
  await page.getByRole("button", { name: "Reset session" }).click();
  await page.getByLabel("Start with the outcome, not a model number.").fill("Something nice");
  await page.getByRole("button", { name: "Research options" }).click();
  await expect(page.getByRole("heading", { name: "One thing to clarify" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Recorded activity/ })).toHaveCount(0);
  await page.getByLabel("Start with the outcome, not a model number.").fill("Headphones under S$400");
  await page.getByRole("button", { name: "Research options" }).click();
  await expect(page.locator(".product-card").first()).toContainText("Sony WH-CH720N");
});

test("rejects malformed activity metadata at the response boundary", async ({ page }) => {
  await page.route("**/api/turn", async (route) => {
    const response = await route.fetch();
    const payload = await response.json() as { toolActivity: unknown };
    payload.toolActivity = [{ provider: "fabricated", outcome: "ok" }];
    await route.fulfill({ response, body: JSON.stringify(payload) });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Wireless headphones for long flights/ }).click();
  await expect(page.getByRole("alert")).toContainText("unreadable result");
  await expect(page.locator(".product-card")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Recorded activity/ })).toHaveCount(0);
});

test("requests optional web context only after an explicit click, including under StrictMode", async ({ page }) => {
  let requests = 0;
  let submitted: { productIds: string[]; preferences: { hard: { budget: { amount: number; currency: string } | null } } } | undefined;
  await page.route("**/api/research", async (route) => {
    requests += 1;
    submitted = route.request().postDataJSON() as typeof submitted;
    await route.fulfill({ json: webResearchResponse() });
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Search the web for context" })).toHaveCount(0);
  await expect.poll(() => requests).toBe(0);
  await researchWithPrompt(page, "Wireless headphones for long flights under S$500");
  await expect(page.getByRole("button", { name: "Search the web for context" })).toBeVisible();
  expect(requests).toBe(0);
  await page.getByRole("button", { name: "Search the web for context" }).click();
  await expect(page.getByText("1 web sources")).toBeVisible();
  expect(requests).toBe(1);
  expect(submitted?.productIds).toHaveLength(3);
  expect(new Set(submitted?.productIds).size).toBe(3);
  expect(submitted?.preferences.hard.budget).toEqual({ amount: 500, currency: "SGD" });
});

test("shows safe web excerpts as text with a safe HTTPS source link", async ({ page }) => {
  await page.route("**/api/research", (route) => route.fulfill({
    json: webResearchResponse({
      results: [{
        title: "<img src=x onerror=alert(1)> source",
        url: "https://www.example.org/reviews/headphones",
        highlights: ["<script>window.__exaXss = true</script>", "<b>Text stays text</b>"],
      }],
    }),
  }));
  await researchWithPrompt(page, "Wireless headphones under S$500");
  await page.getByRole("button", { name: "Search the web for context" }).click();
  await page.getByRole("button", { name: "1 web sources" }).click();
  const source = page.getByRole("link", { name: /<img src=x onerror=alert\(1\)> source/ });
  await expect(source).toHaveAttribute("href", "https://www.example.org/reviews/headphones");
  await expect(source).toHaveAttribute("target", "_blank");
  await expect(source).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.getByText("HTTPS · www.example.org")).toBeVisible();
  await expect(page.getByText("<script>window.__exaXss = true</script>")).toBeVisible();
  await expect(page.getByText("<b>Text stays text</b>")).toBeVisible();
  await expect(page.locator(".web-research img, .web-research script, .web-research b")).toHaveCount(0);
  await expect(page.locator(".web-research")).toContainText("They do not establish the sample price or stock");
});

test("rejects an unsafe source response before rendering a link", async ({ page }) => {
  await page.route("**/api/research", (route) => route.fulfill({
    json: webResearchResponse({
      results: [{ title: "Private target", url: "https://127.0.0.1/private", highlights: ["untrusted"] }],
    }),
  }));
  await researchWithPrompt(page, "Wireless headphones under S$500");
  await page.getByRole("button", { name: "Search the web for context" }).click();
  await expect(page.getByRole("alert")).toContainText("unreadable result");
  await expect(page.locator(".web-research a")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try web research again" })).toBeVisible();
});

test("shows empty and disabled web research responses clearly", async ({ page }) => {
  let requestIndex = 0;
  await page.route("**/api/research", (route) => {
    requestIndex += 1;
    return route.fulfill({
      json: requestIndex === 1
        ? webResearchResponse({ results: [] })
        : { status: "disabled" },
    });
  });
  await researchWithPrompt(page, "Wireless headphones under S$500");
  await page.getByRole("button", { name: "Search the web for context" }).click();
  await expect(page.getByText("No safe source excerpts were available for this shortlist.")).toBeVisible();
  await page.getByRole("button", { name: "Reset session" }).click();
  await researchWithPrompt(page, "Wireless headphones under S$500");
  await page.getByRole("button", { name: "Search the web for context" }).click();
  await expect(page.getByText("Web research is not enabled for this session.")).toBeVisible();
});

test("suppresses double-click requests and permits an explicit retry", async ({ page }) => {
  const started = deferred();
  const release = deferred();
  let requests = 0;
  await page.route("**/api/research", async (route) => {
    requests += 1;
    if (requests === 1) {
      started.resolve();
      await release.promise;
      await route.fulfill({ json: { status: "unavailable", reason: "provider-error" } }).catch(() => undefined);
    } else {
      await route.fulfill({ json: webResearchResponse() });
    }
  });
  await researchWithPrompt(page, "Wireless headphones under S$500");
  const search = page.getByRole("button", { name: "Search the web for context" });
  await search.dblclick();
  await started.promise;
  expect(requests).toBe(1);
  release.resolve();
  await expect(page.getByText("Web research is temporarily unavailable.")).toBeVisible();
  await page.getByRole("button", { name: "Try web research again" }).click();
  await expect(page.getByText("1 web sources")).toBeVisible();
  expect(requests).toBe(2);
});

test("discards pending web sources after an edit", async ({ page }) => {
  const started = deferred();
  const release = deferred();
  let hold = true;
  await page.route("**/api/research", async (route) => {
    if (hold) {
      hold = false;
      started.resolve();
      await release.promise;
      await route.fulfill({ json: webResearchResponse() }).catch(() => undefined);
      return;
    }
    await route.fulfill({ json: webResearchResponse() });
  });
  await researchWithPrompt(page, "Wireless headphones under S$500");
  await page.getByRole("button", { name: "Search the web for context" }).click();
  await started.promise;
  await page.getByLabel("Start with the outcome, not a model number.").fill("A laptop under S$2,000");
  await page.getByRole("button", { name: "Research options" }).click();
  await expect(page.locator(".product-card").first()).toContainText("ASUS");
  release.resolve();
  await expect(page.getByText("1 web sources")).toHaveCount(0);
  await expect(page.locator(".web-research")).toHaveCount(1);
});

test("discards pending web sources after reset and product handoff", async ({ page }) => {
  const holds = Array.from({ length: 2 }, () => ({ started: deferred(), release: deferred() }));
  let requestIndex = 0;
  await page.route("**/api/research", async (route) => {
    const hold = holds[requestIndex++];
    hold.started.resolve();
    await hold.release.promise;
    await route.fulfill({ json: webResearchResponse() }).catch(() => undefined);
  });
  await researchWithPrompt(page, "Wireless headphones under S$500");
  await page.getByRole("button", { name: "Search the web for context" }).click();
  await holds[0].started.promise;
  await page.getByRole("button", { name: "Reset session" }).click();
  holds[0].release.resolve();
  await expect(page.locator(".web-research")).toHaveCount(0);

  await researchWithPrompt(page, "Wireless headphones under S$500");
  await page.getByRole("button", { name: "Search the web for context" }).click();
  await holds[1].started.promise;
  await page.getByRole("button", { name: "Select this product" }).first().click();
  await expect(page.getByRole("heading", { name: "Sony WH-CH720N" })).toBeVisible();
  holds[1].release.resolve();
  await expect(page.locator(".web-research")).toHaveCount(0);
});

test("keeps web source disclosure readable without mobile overflow", async ({ page }) => {
  await page.route("**/api/research", (route) => route.fulfill({
    json: webResearchResponse({
      results: Array.from({ length: 3 }, (_, index) => ({
        title: `Long source title ${index} ${"headphone context ".repeat(8)}`,
        url: `https://www.example.org/research/${index}`,
        highlights: [`Excerpt with a very long source phrase ${"plain language evidence ".repeat(12)}`],
      })),
    }),
  }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await researchWithPrompt(page, "Wireless headphones under S$500");
  await page.getByRole("button", { name: "Search the web for context" }).click();
  await page.getByRole("button", { name: "3 web sources" }).click();
  await page.screenshot({ path: "artifacts/screenshots/web-research-desktop.png", fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoHorizontalOverflow(page);
  await expect(page.getByRole("button", { name: "3 web sources" })).toBeVisible();
  await page.screenshot({ path: "artifacts/screenshots/web-research-mobile.png", fullPage: true, animations: "disabled" });
});
