import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";
import { defaultPreferences } from "../../src/domain/contracts";
import { createExaProductResearch } from "../../src/server/exa-research";
import { historicalReplay, syntheticExtraction, syntheticRawStructure } from "../fixtures/page-evidence";

for (const scenario of ["historical", "synthetic"] as const) {
  test(`renders ${scenario} page evidence through a local SDK replay with visible proof and an accessible composer`, async ({ page }, testInfo) => {
    const preferences = defaultPreferences();
    preferences.hard.category = "headphones";
    preferences.hard.budget = { amount: 400, currency: "SGD" };
    let providerCalls = 0;
    const payload = scenario === "historical" ? historicalReplay : {
      results: [syntheticRawStructure], costDollars: { total: 0.007 },
      output: { content: { observations: [syntheticExtraction] } },
    };
    const server = createServer((incoming, outgoing) => {
      incoming.resume();
      incoming.on("end", () => {
        providerCalls++;
        outgoing.writeHead(200, { "Content-Type": "application/json" });
        outgoing.end(JSON.stringify(payload));
      });
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const result = await createExaProductResearch("fake-test-key", { baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}` })({ message: "Headphones under SGD400", preferences }, new AbortController().signal);
      expect(result.status).toBe("ready");
      if (result.status !== "ready") return;
      let turns = 0;
      await page.route("**/api/health", (route) => route.fulfill({ json: { status: "ok", mode: "fixture", liveIntegrations: true, merchantVerification: "unavailable" } }));
      await page.route("**/api/turn", (route) => {
        turns++;
        return route.fulfill({ json: { kind: "research", answer: scenario === "historical"
          ? "Automated fixture replay of a normalized historical application capture with test-authored extraction. These are historical source observations, not current prices or stock."
          : "Automated synthetic raw-structure fixture with test-authored extraction. These sample specifications and prices are not live evidence.",
        preferences, notes: [], research: result.research } });
      });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto("/");
      await expect(page.locator("html")).toHaveClass(/dark/);
      await page.getByLabel("Message", { exact: true }).fill("Headphones under SGD400");
      await page.getByRole("button", { name: "Send message" }).click();
      await expect(page.getByText(/Automated .*fixture/).first()).toBeVisible();
      if (scenario === "historical") {
        const jbl = page.getByRole("article", { name: "JBL Tour One M3", exact: true });
        const hn = page.getByRole("article", { name: "Sennheiser MOMENTUM 4 Wireless Over-Ear Headphones - Teal (800073)", exact: true });
        await expect(jbl).toContainText("Specifications not established by this source");
        await expect(jbl.getByRole("link", { name: /View source/ })).toHaveAttribute("href", historicalReplay.results[0].url);
        await expect(hn).toContainText("Page price excerpt · Unverified");
        await expect(hn).toContainText("S$ 349 was S$ 499 SGD You Save S$ 150");
        await expect(hn).not.toContainText("42 mm");
        await jbl.getByRole("button", { name: "Evidence and limits" }).click();
        await hn.getByRole("button", { name: "Evidence and limits" }).click();
        await expect(jbl.getByRole("blockquote").first()).toHaveText("# JBL Tour One M3 Premium wireless over-ear Noise Cancelling headphones");
        await expect(hn.getByRole("blockquote").last()).toHaveText("S$ 349 was S$ 499 SGD You Save S$ 150");
        await page.getByRole("button", { name: "Compare research leads" }).click();
        await expect(page.getByRole("table")).toContainText("Not established by this source");
        await expect(page.getByRole("table")).toContainText("S$ 349 was S$ 499 SGD You Save S$ 150");
      } else {
        const card = page.getByRole("article", { name: syntheticExtraction.name });
        await card.getByRole("button", { name: "Evidence and limits" }).click();
        await expect(card).toContainText("Battery life: Up to 60 hours on a full charge.");
        await expect(card).toContainText("Driver size: 42 mm.");
        await expect(card).toContainText("Stock and delivery unverified");
      }
      await page.getByRole("article").first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`${scenario}-desktop-proof.png`), fullPage: true, animations: "disabled" });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("article").first().scrollIntoViewIfNeeded();
      await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
      await page.screenshot({ path: testInfo.outputPath(`${scenario}-mobile-identity.png`), fullPage: true, animations: "disabled" });
      if (scenario === "historical") {
        await page.getByRole("article").last().scrollIntoViewIfNeeded();
        await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
        await page.screenshot({ path: testInfo.outputPath("historical-mobile-price.png"), fullPage: true, animations: "disabled" });
        await page.getByRole("table").scrollIntoViewIfNeeded();
        expect(await page.locator('[data-slot="table-container"]').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath("historical-mobile-comparison.png"), fullPage: true, animations: "disabled" });
      }
      await expect(page.getByRole("button", { name: "Select this product" })).toHaveCount(0);
      expect(providerCalls).toBe(1);
      expect(turns).toBe(1);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
}
