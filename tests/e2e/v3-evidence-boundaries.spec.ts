import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import type { TurnResponse } from "../../src/domain/conversation";

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`${viewport.width}px rejects money-only fit and ambiguous catalog attribution`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route("https://manufacturer.com/**", (route) => route.abort());
    await page.goto("/");
    const directory = "artifacts/issue-64-price-v5/boundary-browser";
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
      const observed = result.research.sources.flatMap((source) => source.moneyOccurrences).find((entry) => product.priceEvidence.observations.includes(entry.id));
      expect(observed?.value).toMatchObject({ kind: "explicit", minorUnits: scenario.observed * 100, currency: "SGD" });
      if (scenario.observed === 868) {
        expect(product.priceEvidence.state).toBe("observed");
        expect(result.research.sources[0]!.text).toContain("SGD 999");
        expect(product.priceEvidence.report!.sourceReviews[0]!.conditions[0]!.text).toBe("Price as listed on Fixture Index.");
      }
      await expect(page.getByText("Fixture data. Automated test substitute.", { exact: true })).toBeVisible();
      await expect(page.getByText(result.research.summary, { exact: true })).toBeVisible();
      if (scenario.observed === 868) await expect(page.getByText(/Purchase conditions remain unresolved/).first()).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Message", exact: true })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if ("adverse" in scenario) {
        expect(product.priceEvidence.alarms.some((alarm) => alarm.kind === "variant-contradiction")).toBe(true);
        expect(product.priceEvidence.report!.attribution.status).toBe("contradicted");
        await expect(page.getByText(/Source context contains a restriction/).first()).toBeVisible();
      }
      await page.screenshot({ path: `${directory}/${viewport.width}-${scenario.id}.png` });
      if ("adverse" in scenario) {
        const disclosure = page.getByRole("button", { name: "Evidence and tradeoffs for Fixture Meridian Sunglasses - Silver", exact: true });
        await disclosure.click();
        await expect.poll(() => disclosure.evaluate((element) => element.parentElement!.querySelector("[data-slot=trace-collapsible-content]")!.getAnimations().length)).toBe(0);
        await expect(page.getByText(/Provider price attribution contradicted, unverified/).first()).toBeVisible();
        await page.getByRole("button", { name: "Sources and research limits", exact: true }).click();
        await page.getByRole("button", { name: result.research.sources[0]!.title, exact: true }).click();
        const context = page.locator("blockquote").filter({ hasText: "New Silver colorway" }).last();
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

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`${viewport.width}px separates AI fit claims and source previews from eligibility`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const directory = "artifacts/issue-64-price-v5/card-interpretation";
    await mkdir(directory, { recursive: true });
    const rationale = "Fixture AI claims the selected product fits the requested price range.";
    const productName = "Fixture Meridian Sunglasses - Silver";
    let unresolved = true;
    let literal = "";
    await page.route("https://manufacturer.com/**", (route) => route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="100"><rect width="180" height="100" fill="#777"/><text x="90" y="55" text-anchor="middle" fill="white">Fixture page preview</text></svg>',
    }));
    await page.route("**/api/session", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      if (unresolved) for (const message of body.state.messages) {
        const snapshot = message.research;
        if (!snapshot) continue;
        const product = snapshot.products.find((entry: { name: string }) => entry.name === productName);
        if (!product) continue;
        product.requestMatch.rationale = rationale;
        const source = snapshot.sources.find((entry: { id: string }) => entry.id === product.identity.support[0]?.sourceId);
        if (source) source.imageUrl = "https://manufacturer.com/fixture-page-preview.svg";
        literal = source.text.slice(product.identity.support[0].context.start, product.identity.support[0].context.end);
      }
      await route.fulfill({ response, json: body });
    });
    await page.goto("/");
    const composer = page.getByRole("textbox", { name: "Message", exact: true });
    await composer.fill("Find spaced catalog ambiguity fixture sunglasses between SGD800 and1000");
    await page.getByRole("button", { name: "Send message", exact: true }).click();
    const card = page.locator('[data-slot="card"]').filter({ has: page.getByText(productName, { exact: true }) });
    await expect(card.getByText("SGD 868.00", { exact: true })).toBeVisible();
    await expect(card.getByText(/Purchase conditions remain unresolved/)).toBeVisible();
    await expect(card.getByText(/^Unresolved:/)).toBeVisible();
    await expect(card.getByText(rationale, { exact: false })).not.toBeVisible();
    await expect(card.getByText("Source-supported option", { exact: true })).toHaveCount(0);
    const preview = card.getByRole("img", { name: `Source page preview for ${productName}`, exact: true });
    await expect(preview).toBeVisible();
    await expect.poll(() => preview.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(card.getByText("Source page preview. Product image and exact variant unverified.", { exact: true })).toBeVisible();
    await expect(page.getByText(productName, { exact: true })).toBeInViewport();
    await expect(composer).toBeInViewport();
    await page.screenshot({ path: `${directory}/${viewport.width}-unresolved.png` });
    const disclosure = card.getByRole("button", { name: `Evidence and tradeoffs for ${productName}`, exact: true });
    await disclosure.scrollIntoViewIfNeeded();
    await disclosure.focus();
    await disclosure.press("Enter");
    await expect.poll(() => disclosure.evaluate((element) => element.parentElement!.querySelector("[data-slot=trace-collapsible-content]")!.getAnimations().length)).toBe(0);
    const interpretation = card.getByText(rationale, { exact: false });
    await expect(interpretation).toBeVisible();
    await expect(interpretation).toContainText("AI assessment, unverified:");
    expect(await card.locator("blockquote").filter({ hasText: productName }).first().textContent()).toBe(literal);
    await interpretation.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await expect(interpretation).toBeInViewport();
    await expect(composer).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${directory}/${viewport.width}-assessment.png`, animations: "disabled" });
    const original = await page.request.get("/api/session").then((response) => response.json());
    const retained = original.state.messages.find((message: { research?: { products: { name: string }[] } }) => message.research?.products[0]?.name === productName).research;
    expect(retained.products[0].priceEvidence.state).toBe("observed");
    expect(retained.products[0].eligible).toBe(false);
    expect(retained.choice).toBeNull();
    const span = retained.products[0].identity.support[0];
    expect(retained.sources.find((source: { id: string }) => source.id === span.sourceId).text.slice(span.context.start, span.context.end)).toBe(literal);
    unresolved = false;
    await page.getByRole("button", { name: "New chat", exact: true }).click();
    await expect(page.getByRole("heading", { name: "What are you looking for?", exact: true })).toBeVisible();
    await composer.fill("Find a fixture powerbank between SGD30 and40");
    await page.getByRole("button", { name: "Send message", exact: true }).click();
    const eligible = page.locator('[data-slot="card"]').filter({ has: page.getByText("Fixture Powerbank Model A", { exact: true }) });
    await expect(eligible.getByText("Source-supported option", { exact: true })).toBeVisible();
    await expect(eligible.getByRole("img", { name: "Source page preview for Fixture Powerbank Model A", exact: true })).toBeVisible();
    await expect(page.getByText(/^Fixture Powerbank Model A is a source-supported option/)).toBeInViewport();
    await expect(composer).toBeInViewport();
    await page.screenshot({ path: `${directory}/${viewport.width}-eligible.png` });
    await writeFile(`${directory}/${viewport.width}-proof.json`, JSON.stringify({ commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), viewport, fixtureOnly: true, providerRationale: rationale, literalContext: literal, eligibilityUnchanged: true, keyboardDisclosure: true }, null, 2) + "\n");
  });
}
