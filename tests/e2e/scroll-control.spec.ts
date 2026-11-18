import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";
import { defaultPreferences } from "../../src/domain/contracts";
import { createExaProductResearch } from "../../src/server/exa-research";
import { productResearchResponse } from "../fixtures/exa-research";

test.use({ hasTouch: true, reducedMotion: "reduce" });

for (const width of [390, 1440]) {
  test(`keeps conversation controls reachable beside active scroll navigation at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const preferences = defaultPreferences();
    preferences.hard.category = "headphones";
    preferences.hard.budget = { amount: 300, currency: "SGD" };
    const provider = createServer((request, response) => {
      request.resume();
      request.on("end", () => {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify(productResearchResponse));
      });
    });
    provider.listen(0, "127.0.0.1");
    await once(provider, "listening");
    try {
      const research = await createExaProductResearch("fake-test-key", {
        baseUrl: `http://127.0.0.1:${(provider.address() as AddressInfo).port}`,
      })({ message: "Headphones under SGD300", preferences }, new AbortController().signal);
      expect(research.status).toBe("ready");
      if (research.status !== "ready") throw new Error("Local research fixture is unavailable");
      let turnCalls = 0;
      await page.route("**/api/health", (route) => route.fulfill({ json: {
        status: "ok", mode: "research", liveIntegrations: true, merchantVerification: "unavailable",
      } }));
      await page.route("**/api/turn", (route) => {
        turnCalls++;
        return route.fulfill({ json: {
          kind: "research", preferences, notes: [],
          answer: "Automated fixture research. These quotations are not live evidence.",
          research: research.research,
        } });
      });
      await page.goto("/");
      await page.getByLabel("Message", { exact: true }).fill("Headphones under SGD300");
      await page.getByRole("button", { name: "Send message", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Research leads" })).toBeVisible();
      for (const disclosure of await page.getByRole("button", { name: "Evidence and limits", exact: true }).all()) {
        await disclosure.click();
      }
      await page.getByRole("button", { name: "Compare research leads", exact: true }).click();
      await page.getByRole("button", { name: "2 research sources", exact: true }).click();
      await page.getByRole("button", { name: "Research limits", exact: true }).click();
      const viewport = page.locator('[data-slot="message-scroller-viewport"]');
      const edit = page.getByRole("button", { name: "Edit preferences", exact: true });
      const arrow = page.getByRole("button", { name: "Scroll to latest message", exact: true });
      await viewport.evaluate((element) => { element.scrollTop = element.scrollHeight - element.clientHeight - 40; });
      for (let frame = 0; frame < 2; frame++) {
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        const editorBox = (await edit.boundingBox())!;
        const viewportBox = (await viewport.boundingBox())!;
        await viewport.evaluate((element, delta) => { element.scrollTop += delta; }, editorBox.y + editorBox.height / 2 - (viewportBox.y + viewportBox.height - 38));
      }
      await expect(arrow).toHaveAttribute("data-active", "true");
      await expect(edit).toBeInViewport({ ratio: 1 });
      await expect.poll(() => edit.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest("button") === element;
      })).toBe(true);
      const arrowBox = (await arrow.boundingBox())!;
      const editorBox = (await edit.boundingBox())!;
      expect(arrowBox.width).toBeGreaterThanOrEqual(44);
      expect(arrowBox.height).toBeGreaterThanOrEqual(44);
      expect(arrowBox.x >= editorBox.x + editorBox.width || arrowBox.x + arrowBox.width <= editorBox.x || arrowBox.y >= editorBox.y + editorBox.height || arrowBox.y + arrowBox.height <= editorBox.y).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`active-navigation-${width}.png`), fullPage: true, animations: "disabled" });
      await edit.tap();
      await expect(page.getByRole("heading", { name: "Edit preferences", exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`preferences-${width}.png`), fullPage: true, animations: "disabled" });
      await page.getByRole("button", { name: "Close preferences", exact: true }).click();
      await edit.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("heading", { name: "Edit preferences", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Close preferences", exact: true }).click();
      await page.getByLabel("Message", { exact: true }).fill("Keep this unsent draft");
      await viewport.evaluate((element) => { element.scrollTop = 0; });
      await expect(arrow).toHaveAttribute("data-active", "true");
      await arrow.click();
      await expect.poll(() => viewport.evaluate((element) => Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop))).toBeLessThanOrEqual(1);
      await expect(page.getByLabel("Message", { exact: true })).toHaveValue("Keep this unsent draft");
      expect(turnCalls).toBe(1);
      await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      await page.screenshot({ path: testInfo.outputPath(`latest-message-${width}.png`), fullPage: true, animations: "disabled" });
    } finally {
      provider.closeAllConnections();
      await new Promise<void>((resolve, reject) => provider.close((error) => error ? reject(error) : resolve()));
    }
  });
}
