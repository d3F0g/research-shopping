import { expect, test } from "@playwright/test";
import { phoneBudgetRequest } from "../fixtures/conversational-budget";
import { actualComposition } from "./support/actual-composition";

test("uses the supplied conversational budget without another budget question", async ({
  page,
}, testInfo) => {
  const transport = await actualComposition(page, testInfo);
  transport.pauseResearch();
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(transport.baseUrl);
    await page.getByLabel("Message", { exact: true }).fill(phoneBudgetRequest);
    await page.getByRole("button", { name: "Send message", exact: true }).click();
    const last = page.getByTestId("conversation-turn").last();
    await expect(last).toHaveAttribute("data-active", "true");
    await expect(last.locator(".intent-summary > p")).toHaveText(
      "SGD 500–600",
    );
    await expect(last).toContainText("The amount without a currency uses SGD.");
    await expect(last).toContainText("local usage safeguard");
    await expect(
      last.getByRole("heading", { name: "Any budget in mind?" }),
    ).toHaveCount(0);
    expect(transport.requests).toHaveLength(2);
    expect(transport.requests[1]).toMatchObject({
      phase: "research",
      preferences: { budget: { minimum: 500, amount: 600, currency: "SGD" } },
    });
    expect(transport.sdkRequests).toHaveLength(0);
    await page.screenshot({
      path: testInfo.outputPath("desktop-conversational-budget.png"),
    });
    await page.setViewportSize({ width: 390, height: 600 });
    const compare = last.getByRole("button", {
      name: "Compare options",
      exact: true,
    });
    await compare.scrollIntoViewIfNeeded();
    await expect(compare).toBeInViewport();
    await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
    const compareBounds = await compare.boundingBox();
    const composerBounds = await page
      .getByLabel("Message", { exact: true })
      .boundingBox();
    expect(compareBounds).not.toBeNull();
    expect(composerBounds).not.toBeNull();
    expect(compareBounds!.y + compareBounds!.height).toBeLessThan(
      composerBounds!.y,
    );
    expect(
      await page.evaluate(() => document.body.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.screenshot({
      path: testInfo.outputPath("mobile-conversational-budget.png"),
    });
  } finally {
    await transport.close();
  }
});
