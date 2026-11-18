import { expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

export const screenshot = async (page: Page, name: string) => {
  await mkdir("artifacts/personalization/browser", { recursive: true });
  const previous = page.viewportSize()!;
  if (/form|account-data|unavailable/.test(name))
    await expect(page.getByRole("dialog")).toBeVisible();
  for (const [label, viewport] of [
    ["desktop", { width: 1440, height: 900 }],
    ["mobile", { width: 390, height: 844 }],
  ] as const) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/personalization/browser/${label}-${name.replace(/^(desktop|mobile)-/, "")}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
  await page.setViewportSize(previous);
};
export async function register(page: Page, email: string) {
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("button", { name: "Create a local account" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Browser fixture");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("fixture-browser-password-only");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}
export async function send(page: Page, text: string) {
  await page.getByRole("textbox", { name: "Message", exact: true }).fill(text);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
}
export async function signout(page: Page) {
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}
