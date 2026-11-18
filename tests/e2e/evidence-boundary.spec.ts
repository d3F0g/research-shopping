import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";
import { defaultPreferences } from "../../src/domain/contracts";
import { createExaProductResearch } from "../../src/server/exa-research";

test("renders ambiguous prices and unrelated products as limited source context", async ({ page }, testInfo) => {
  const preferences = defaultPreferences();
  preferences.hard.category = "headphones";
  preferences.hard.budget = { amount: 300, currency: "SGD" };
  const category = "Aster Wave 2 is a pair of wireless headphones.";
  const monthlyPrice = "Aster Wave 2 costs SGD 99/month.";
  const sweater = "Aster Wave 2 is a cotton sweater.";
  const url = "https://reviews.example.com/aster-wave-2";
  let providerCalls = 0;
  const server = createServer((incoming, outgoing) => {
    incoming.resume();
    incoming.on("end", () => {
      const relevant = providerCalls++ === 0;
      outgoing.writeHead(200, { "Content-Type": "application/json" });
      outgoing.end(JSON.stringify({
        results: [{
          title: "Automated fixture source",
          url,
          highlights: relevant ? [category, monthlyPrice] : [sweater],
        }],
        output: { content: { observations: [{
          name: "Aster Wave 2", url,
          identityQuote: null, quotedFacts: [relevant ? category : sweater],
          priceQuote: relevant ? monthlyPrice : null,
        }] }, grounding: [] },
      }));
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const research = createExaProductResearch("fake-test-key", {
    baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
  });
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const response = await research({ message: "Headphones under SGD300", preferences }, new AbortController().signal);
    const unrelated = await research({ message: "Other headphones under SGD300", preferences }, new AbortController().signal);
    expect(providerCalls).toBe(2);
    expect(response.status).toBe("ready");
    expect(unrelated.status).toBe("ready");
    if (response.status !== "ready" || unrelated.status !== "ready") return;
    let turns = 0;
    await page.route("**/api/health", (route) => route.fulfill({ json: {
      status: "ok", mode: "fixture", liveIntegrations: true, merchantVerification: "unavailable",
    } }));
    await page.route("**/api/turn", (route) => route.fulfill({ json: {
      kind: "research", preferences, notes: [],
      answer: "Automated fixture research. Source quotations do not establish current prices or stock.",
      research: turns++ === 0 ? response.research : unrelated.research,
    } }));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByLabel("Message", { exact: true }).fill("Headphones under SGD300");
    await page.getByRole("button", { name: "Send message" }).click();
    const card = page.getByRole("article", { name: "Aster Wave 2" });
    await expect(card).toContainText("No attributable price observation");
    await expect(card).not.toContainText(monthlyPrice);
    await page.getByRole("button", { name: "1 research sources" }).click();
    await expect(page.getByText(monthlyPrice, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /View source/ }).first()).toHaveAttribute("href", url);
    await page.screenshot({ path: testInfo.outputPath("ambiguous-price-desktop.png"), fullPage: true, animations: "disabled" });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
    await page.getByText(monthlyPrice, { exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByText(monthlyPrice, { exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.screenshot({ path: testInfo.outputPath("ambiguous-price-mobile.png"), fullPage: true, animations: "disabled" });
    await page.getByLabel("Message", { exact: true }).fill("Other headphones under SGD300");
    await page.getByRole("button", { name: "Send message" }).click();
    const currentTurn = page.getByTestId("conversation-turn").last();
    await expect(currentTurn.getByRole("article")).toHaveCount(0);
    await currentTurn.getByRole("button", { name: "1 research sources" }).click();
    await currentTurn.getByRole("button", { name: "Research limits" }).click();
    await expect(currentTurn.getByText(sweater, { exact: true })).toBeVisible();
    await expect(currentTurn).toContainText("No product had sufficiently attributable model, category and constraint evidence");
    await expect(currentTurn.getByRole("button", { name: "Compare research leads" })).toHaveCount(0);
    await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath("unrelated-source-mobile.png"), fullPage: true, animations: "disabled" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: testInfo.outputPath("unrelated-source-desktop.png"), fullPage: true, animations: "disabled" });
    expect(turns).toBe(2);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
