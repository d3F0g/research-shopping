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
  await expect(sony.getByText("CONFLICTING SAMPLE CLAIMS")).toBeVisible();
  await expect(sony.getByText("Synthetic fixture timestamp · 15 Jan 2025").first()).toBeVisible();
  const sourceLink = sony.getByRole("link", { name: /Manufacturer reference\/model page/ }).first();
  await expect(sourceLink).toHaveAttribute("href", "https://www.sony.com.sg/headphones/products/wh-ch720n");
  await expect(sourceLink).toHaveAttribute("target", "_blank");
  await expect(sourceLink).toHaveAttribute("rel", /noopener/);

  await mkdir("artifacts/screenshots", { recursive: true });
  await page.screenshot({ path: "artifacts/screenshots/shortlist-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: "artifacts/screenshots/shortlist-mobile.png", fullPage: true });

  await sony.getByRole("button", { name: "Select this product" }).click();
  await expect(page.getByRole("heading", { name: "Sony WH-CH720N" })).toBeVisible();
  const merchantLink = page.getByRole("link", { name: /Open manufacturer product page/ });
  await expect(merchantLink).toHaveAttribute("href", "https://www.sony.com.sg/headphones/products/wh-ch720n");
  await expect(merchantLink).toHaveAttribute("rel", /noopener/);
  await expect(page.getByText("Sample price · fixture only")).toBeVisible();
  await assertNoHorizontalOverflow(page);
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
  await expect(page.getByText("The first selected priority has the most influence.")).toBeVisible();
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
