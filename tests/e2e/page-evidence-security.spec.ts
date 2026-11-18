import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";
import { defaultPreferences } from "../../src/domain/contracts";
import { createExaProductResearch } from "../../src/server/exa-research";
import { scopedResponse, scopedText } from "../fixtures/page-evidence-security";

for (const scenario of ["foreign-attribute-and-price", "inline-negative", "cross-highlight-negative", "title-conflict", "unknown-contract-field"] as const) {
  test(`keeps ${scenario} honest through a local SDK replay and browser`, async ({ page }, testInfo) => {
    const preferences = defaultPreferences();
    preferences.hard.category = "headphones";
    preferences.hard.budget = { amount: 400, currency: "SGD" };
    let payload = scopedResponse();
    if (scenario === "foreign-attribute-and-price") payload = scopedResponse(scopedText.replace("Driver size: 42 mm.", "Battery life: 60 hours for Orbit Quiet.") + "\nper month for 12 months", { quotedFacts: ["Battery life: 60 hours for Orbit Quiet."] });
    if (scenario === "inline-negative") {
      payload = scopedResponse("# Aster Wave 2 Wireless over-ear headphones ## Specifications Wireless: No", { quotedFacts: [], priceQuote: null });
      preferences.hard.requiredFeatures = ["wireless"];
    }
    if (scenario === "cross-highlight-negative") {
      payload.results[0].highlights.push("Aster Wave 2 is a pair of wired-only headphones.");
      preferences.hard.requiredFeatures = ["wireless"];
    }
    if (scenario === "title-conflict") payload = scopedResponse(scopedText, {}, "Aster Wave 2 Pro | Synthetic raw-structure fixture");
    let calls = 0;
    const server = createServer((request, response) => {
      request.resume();
      request.on("end", () => {
        calls++;
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify(payload));
      });
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const result = await createExaProductResearch("fake-key-local-only", { baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}` })({ message: "Headphones under SGD400", preferences }, new AbortController().signal);
      expect(result.status).toBe("ready");
      if (result.status !== "ready") return;
      const research = scenario === "unknown-contract-field" ? { ...result.research, assessmentVersion: 999 } : result.research;
      await page.route("**/api/health", (route) => route.fulfill({ json: { status: "ok", mode: "fixture", liveIntegrations: false } }));
      await page.route("**/api/turn", (route) => route.fulfill({ json: { kind: "research", answer: "Automated synthetic fixture. Ambiguous claims stay in source context and do not establish product specifications or prices.", preferences, notes: [], research } }));
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto("/");
      await page.getByLabel("Message", { exact: true }).fill("Headphones under SGD400");
      await page.getByRole("button", { name: "Send message" }).click();
      if (scenario === "unknown-contract-field") {
        await expect(page.getByRole("alert")).toContainText("unreadable result");
        await expect(page.getByRole("article")).toHaveCount(0);
        await expect(page.getByRole("link", { name: /View source/ })).toHaveCount(0);
      } else {
        if (scenario === "foreign-attribute-and-price") {
          const card = page.getByRole("article", { name: "Aster Wave 2", exact: true });
          await expect(card).toContainText("Specifications not established by this source");
          await expect(card).toContainText("No attributable price observation");
          await expect(card).not.toContainText("Orbit Quiet");
          await expect(card).not.toContainText("SGD 349");
          await card.getByRole("button", { name: "Evidence and limits" }).click();
        } else await expect(page.getByRole("article")).toHaveCount(0);
        await page.getByRole("button", { name: "1 research sources" }).click();
        await expect(page.locator(".web-research-highlights")).toContainText(scenario === "inline-negative" ? "Wireless: No" : scenario === "cross-highlight-negative" ? "wired-only headphones" : scenario === "title-conflict" ? "# Aster Wave 2" : "per month for 12 months");
      }
      await page.screenshot({ path: testInfo.outputPath(`${scenario}-desktop.png`), fullPage: true, animations: "disabled" });
      await page.setViewportSize({ width: 390, height: 844 });
      if (scenario !== "unknown-contract-field") await page.locator(".web-research-highlights").scrollIntoViewIfNeeded();
      await expect(page.getByText("Fixture data", { exact: true })).toBeVisible();
      await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
      await page.screenshot({ path: testInfo.outputPath(`${scenario}-mobile.png`), fullPage: true, animations: "disabled" });
      expect(calls).toBe(1);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
}
