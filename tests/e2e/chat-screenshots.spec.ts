import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

for (const size of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`captures chat acceptance states on ${size.name}`, async ({ page }) => {
    await mkdir("artifacts/chat-first/application", { recursive: true });
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    const shot = async (state: string) => {
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBe(size.width);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollHeight))
        .toBe(size.height);
      await page.screenshot({
        path: `artifacts/chat-first/application/${state}-${size.name}.png`,
        animations: "disabled",
      });
    };
    const send = async (message: string) => {
      await page.getByLabel("Message", { exact: true }).fill(message);
      await page
        .getByRole("button", { name: "Send message", exact: true })
        .click();
      await expect(
        page.getByTestId("conversation-turn").last(),
      ).toHaveAttribute("data-active", "true");
    };
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await shot("01-empty-dark");
    await send("Hi");
    await expect(page.getByTestId("assistant-message")).toContainText(
      "Hi. What are you looking for?",
    );
    await shot("02-ordinary-message");
    await send("Something nice");
    await expect(
      page.getByRole("button", { name: "Headphones", exact: true }),
    ).toBeVisible();
    await shot("03-category-question");
    await page.getByRole("button", { name: "Headphones", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Any budget in mind?" }),
    ).toBeVisible();
    await shot("04-budget-question");
    await page.getByRole("button", { name: "SGD 500", exact: true }).click();
    await expect(
      page.getByTestId("conversation-turn").last().locator(".product-card"),
    ).toHaveCount(3);
    await shot("05-shortlist");
    await send("under SGD200");
    await expect(
      page.getByTestId("conversation-turn").last().locator(".product-card"),
    ).toHaveCount(1);
    await shot("06-budget-followup");
    await page
      .getByTestId("conversation-turn")
      .last()
      .getByRole("button", { name: "Evidence and limits" })
      .click();
    await expect(
      page.getByText("CONFLICTING SAMPLE CLAIMS", { exact: true }),
    ).toBeVisible();
    await shot("07-evidence");
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await expect(page.locator("html")).toHaveClass(/light/);
    await shot("08-light-conversation");
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/light/);
    await expect(
      page.getByRole("heading", { name: "What are you looking for?" }),
    ).toBeVisible();
    await shot("09-light-persisted");
  });
}
