import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import type { TurnResponse } from "../../src/domain/conversation";

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`${viewport.width}px rejects money-only fit and ambiguous catalog attribution`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route("https://manufacturer.com/**", (route) => route.abort());
    await page.goto("/");
    const directory = "artifacts/fieldnote-v4/boundary-browser";
    await mkdir(directory, { recursive: true });
    const outcomes = [];
    const scenarios = [
      { id: "suffix-money", message: "Find a suffix money-only fixture USB-C powerbank between SGD30 and40", observed: 35 },
      { id: "bare-money", message: "Find a bare money-only fixture USB-C powerbank", observed: 35 },
      { id: "spaced-target", message: "Find spaced catalog ambiguity fixture sunglasses between SGD800 and1000", observed: 868 },
      { id: "bare-variant", message: "Find bare catalog ambiguity fixture sunglasses between SGD800 and1000", observed: 868 },
      { id: "qualified-target", message: "Find qualified catalog ambiguity fixture sunglasses between SGD800 and1000", observed: 868, adverse: true },
      { id: "distinct-peer", message: "Find distinct catalog ambiguity fixture sunglasses between SGD800 and1000", observed: 868 },
    ];
    for (const scenario of scenarios) {
      if (outcomes.length) {
        await page.getByRole("button", { name: "New chat", exact: true }).click();
        await expect(page.getByRole("heading", { name: "What are you looking for?", exact: true })).toBeVisible();
      }
      const response = page.waitForResponse((response) => response.url().endsWith("/api/turn") && response.request().postDataJSON()?.phase === "research");
      await page.getByRole("textbox", { name: "Message", exact: true }).fill(scenario.message);
      await page.getByRole("button", { name: "Send message", exact: true }).click();
      const result = await (await response).json() as TurnResponse;
      expect(result.kind).toBe("research");
      if (result.kind !== "research") throw new Error("Expected fixture comparison");
      expect(result.research.choice).toBeNull();
      expect(result.research.products.every((product) => product.requestMatch.status === "unknown" && !product.eligible)).toBe(true);
      const product = result.research.products[0]!;
      if (scenario.observed === 868) {
        expect(product.price).toBeNull();
        expect(product.priceObservation?.amount).toBe(868);
        expect(product.priceObservation?.row.context.text).toContain("SGD 999");
      } else expect(product.price?.amount).toBe(scenario.observed);
      await expect(page.getByText("Fixture data. Automated test substitute.", { exact: true })).toBeVisible();
      await expect(page.getByText(result.research.summary, { exact: true })).toBeVisible();
      if (scenario.observed === 868) await expect(page.getByText(/Provider-reported, unverified: Price as listed on Fixture Index/)).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Message", exact: true })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if ("adverse" in scenario) {
        await expect(page.getByText(/Source context: For Gold only/)).toBeVisible();
        await expect(page.getByText(/Provider price assessment contradicted, unverified/)).toBeVisible();
      }
      await page.screenshot({ path: `${directory}/${viewport.width}-${scenario.id}.png` });
      if ("adverse" in scenario) {
        const disclosure = page.getByRole("button", { name: "Evidence and tradeoffs for Fixture Meridian Sunglasses - Silver", exact: true });
        await disclosure.click();
        await expect.poll(() => disclosure.evaluate((element) => element.parentElement!.querySelector("[data-slot=trace-collapsible-content]")!.getAnimations().length)).toBe(0);
        const context = page.locator("blockquote").filter({ hasText: "New Silver colorway" });
        await expect(context).toContainText("SGD 999");
        await expect(context).toContainText("For Gold only.");
        await context.evaluate((element) => element.scrollIntoView({ block: "end" }));
        await expect(context).toBeInViewport();
        await page.screenshot({ path: `${directory}/${viewport.width}-${scenario.id}-context.png`, animations: "disabled" });
      }
      outcomes.push({ id: scenario.id, summary: result.research.summary, choice: result.research.choice, products: result.research.products });
    }
    await writeFile(`${directory}/${viewport.width}-proof.json`, JSON.stringify({ commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), viewport, fixtureOnly: true, outcomes }, null, 2) + "\n");
  });
}
