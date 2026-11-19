import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
  test(`${viewport.name} chat currency, evidence, history, theme and composer`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route("**/model-*.png", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="100"><rect x="55" y="10" width="70" height="80" rx="8" fill="#777"/><text x="90" y="55" text-anchor="middle" fill="white">Fixture</text></svg>' }));
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass("dark");
    await expect(page.getByRole("heading", { name: "What are you looking for?" })).toBeVisible();
    const composer = page.getByRole("textbox", { name: "Message", exact: true });
    await expect(composer).toBeVisible();
    await mkdir("artifacts/fieldnote-v2", { recursive: true });
    await page.screenshot({ path: `artifacts/fieldnote-v2/${viewport.name}-empty.png` });
    await composer.fill("I want to buy a powerbank around $30-40."); await page.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(page.getByRole("button", { name: "SGD", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "SGD", exact: true }).click();
    await expect(page.getByText("Fixture data. Automated test substitute.", { exact: true })).toBeVisible();
    await expect(page.getByText("Fixture Powerbank Model A", { exact: true })).toBeVisible();
    await expect(page.getByText("SGD 30–40", { exact: true })).toBeVisible();
    await page.screenshot({ path: `artifacts/fieldnote-v2/${viewport.name}-research.png` });
    await page.getByRole("button", { name: "Evidence and tradeoffs for Fixture Powerbank Model A", exact: true }).click();
    await expect(page.getByText(/^Product identity/).first()).toBeVisible();
    await expect(page.locator("blockquote").first()).toContainText("Fixture data:");
    await page.screenshot({ path: `artifacts/fieldnote-v2/${viewport.name}-evidence.png` });
    const before = await page.request.get("/api/test-stats").then((r) => r.json()) as { calls: number };
    await composer.fill("Compare the first two."); await page.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(page.getByText(/Fixture Powerbank Model A: Battery life/)).toBeVisible();
    const after = await page.request.get("/api/test-stats").then((r) => r.json()) as { calls: number };
    expect(after.calls).toBe(before.calls);
    const box = await composer.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width); expect(box!.y + box!.height).toBeLessThan(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Switch to light mode" }).click(); await page.reload(); await expect(page.locator("html")).toHaveClass("light");
    await expect(page.getByText(/Fixture Powerbank Model A: Battery life/)).toBeVisible();
    await page.getByRole("button", { name: "New chat", exact: true }).click(); await expect(page.getByRole("heading", { name: "What are you looking for?" })).toBeVisible();
    await composer.fill("hello"); await page.getByRole("button", { name: "Send message", exact: true }).click(); await expect(page.getByText("Hi. What are you looking to buy?", { exact: true })).toBeVisible();
    await page.screenshot({ path: `artifacts/fieldnote-v2/${viewport.name}-light-ordinary.png` });
  });
}
