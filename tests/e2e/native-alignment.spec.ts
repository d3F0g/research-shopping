import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { createExaProductResearch } from "../../src/server/exa-research";
import { createResearchTurns } from "../../src/server/research-turns";
import { ath, captureLabel, capturedReplay } from "../fixtures/native-alignment";

test.use({ hasTouch: true });

test("shows useful exact captured research with complete support and responsive comparison", async ({ page }, testInfo) => {
  let calls = 0;
  let settlements = 0;
  const server = createServer((request, response) => {
    request.resume();
    request.on("end", () => {
      calls++;
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(capturedReplay));
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const target = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    expect(new URL(target).origin).toBe(baseUrl);
    return originalFetch(input, init);
  };
  try {
    const app = createApp({ researchTurns: createResearchTurns({
      research: createExaProductResearch("fake-captured-replay-key", { baseUrl }),
      quota: { async reserve() { return "admitted"; }, async settle() { settlements++; } },
    }) }, { apiPort: 6397, webPort: 6398 });
    await page.route("**/api/turn", async (route) => {
      const response = await app.request("http://127.0.0.1:6397/api/turn", { method: "POST", headers: { "Content-Type": "application/json" }, body: route.request().postData() });
      const result = await response.json();
      result.answer = `${captureLabel} ${result.answer}`;
      await testInfo.attach("derived-captured-replay-response.json", { body: JSON.stringify(result, null, 2), contentType: "application/json" });
      await route.fulfill({ status: response.status, json: result });
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByLabel("Message", { exact: true }).fill("Headphones for music under SGD400. Compare sound quality and battery life.");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText(/Automated replay of captured diagnostic fields/)).toBeVisible();
    const athCard = page.getByRole("article", { name: ath.name, exact: true });
    const edifier = page.getByRole("article", { name: "Edifier WH950NB (2025 edition) Wireless Noise Cancelling Headphone", exact: true });
    const hn = page.getByRole("article", { name: "Sennheiser MOMENTUM 4 Wireless Over-Ear Headphones - Teal (800073)", exact: true });
    await expect(athCard).toContainText("battery life of up to 50 hours on a continuous full charge");
    await expect(edifier).toContainText("Titanium-coated 40mm drivers deliver powerful, balanced sound.");
    await expect(edifier).not.toContainText("80 hours");
    await expect(hn).toContainText("Page price excerpt · Unverified");
    await expect(hn).toContainText("S$ 349 was S$ 499 SGD You Save S$ 150");
    await expect(hn).not.toContainText("42 mm");
    await expect(page.getByRole("button", { name: "Select this product" })).toHaveCount(0);
    await athCard.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("captured-desktop-leads.png"), fullPage: true, animations: "disabled" });
    for (const card of [athCard, edifier, hn]) {
      await card.getByRole("button", { name: "Evidence and limits" }).click();
      await expect(card).toContainText("Current affordability within SGD 400 is unverified");
      await expect(card).toContainText("Stock and delivery unverified");
    }
    await expect(athCard).toContainText(ath.driver);
    await expect(athCard).toContainText(ath.battery);
    await athCard.getByRole("button", { name: "Evidence and limits" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("captured-desktop-ath-evidence.png"), fullPage: true, animations: "disabled" });
    await hn.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("captured-desktop-price.png"), fullPage: true, animations: "disabled" });
    const compare = page.getByRole("button", { name: "Compare research leads" });
    await compare.focus();
    await page.keyboard.press("Enter");
    const comparison = page.getByRole("region", { name: "Research lead comparison", exact: true });
    const athComparison = comparison.getByRole("group", { name: ath.name, exact: true });
    const edifierComparison = comparison.getByRole("group", { name: "Edifier WH950NB (2025 edition) Wireless Noise Cancelling Headphone", exact: true });
    await expect(comparison).toBeVisible();
    await expect(athComparison).toContainText("2 quoted specifications");
    await expect(athComparison.getByRole("blockquote")).toHaveCount(0);
    await expect(comparison).toContainText("S$ 349 was S$ 499 SGD You Save S$ 150");
    await athComparison.getByRole("button", { name: `Evidence for ${ath.name}`, exact: true }).focus();
    await page.keyboard.press("Enter");
    await edifierComparison.getByRole("button", { name: /Evidence for/ }).click();
    await expect(athComparison).toContainText(ath.driver);
    await expect(athComparison).toContainText(ath.battery);
    await expect(edifierComparison).toContainText("Titanium-coated 40mm drivers deliver powerful, balanced sound.");
    await expect(comparison).not.toContainText("80 hours");
    await expect(athComparison).toContainText("Current affordability within SGD 400 is unverified");
    await athComparison.getByRole("button", { name: `Evidence for ${ath.name}`, exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(athComparison.getByRole("link", { name: /View source/ })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(athComparison.getByRole("button", { name: /Preview source/ }).first()).toBeFocused();
    const citationPreview = page.locator(".citation-preview");
    await expect(citationPreview.getByRole("link", { name: /View source/ })).toBeVisible();
    await expect(citationPreview.getByRole("link", { name: /View source/ })).toHaveAttribute("href", capturedReplay.results[0].url);
    await page.keyboard.press("Escape");
    await expect(citationPreview).not.toBeVisible();
    await comparison.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("captured-desktop-comparison.png"), fullPage: true, animations: "disabled" });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(390);
    const mobileEvidence = athComparison.getByRole("button", { name: `Evidence for ${ath.name}`, exact: true });
    await mobileEvidence.tap();
    await expect(mobileEvidence).toHaveAttribute("aria-expanded", "false");
    await mobileEvidence.tap();
    await expect(mobileEvidence).toHaveAttribute("aria-expanded", "true");
    await expect(athComparison).toContainText(ath.battery);
    for (const quote of await athComparison.getByRole("blockquote").all()) {
      expect((await quote.boundingBox())!.width).toBeGreaterThan(280);
    }
    await expect(athComparison.getByRole("link", { name: /View source/ })).toHaveAttribute("href", capturedReplay.results[0].url);
    for (const [name, locator] of [["ath", athCard], ["edifier", edifier], ["price", hn], ["comparison", athComparison]] as const) {
      await locator.scrollIntoViewIfNeeded();
      await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
      await page.screenshot({ path: testInfo.outputPath(`captured-mobile-${name}.png`), fullPage: true, animations: "disabled" });
    }
    await page.setViewportSize({ width: 390, height: 600 });
    await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
    const composer = await page.getByLabel("Message", { exact: true }).boundingBox();
    expect(composer).not.toBeNull();
    expect(await page.evaluate(({ x, y }) => {
      const hit = document.elementFromPoint(x, y);
      return hit?.getAttribute("aria-label") === "Message";
    }, { x: composer!.x + composer!.width / 2, y: composer!.y + composer!.height / 2 })).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("captured-mobile-short-composer.png"), animations: "disabled" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "5 research sources" }).click();
    const support = page.locator(".web-research-highlights > li").filter({ hasText: ath.microphone });
    await expect(support).toContainText(ath.controls);
    await expect(support).toContainText(ath.battery);
    await support.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("captured-mobile-support.png"), fullPage: true, animations: "disabled" });
    await page.getByLabel("Message", { exact: true }).fill("Thanks");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Thanks", { exact: true })).toBeVisible();
    expect(calls).toBe(1);
    expect(settlements).toBe(1);
    expect(errors).toEqual([]);
  } finally {
    globalThis.fetch = originalFetch;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
