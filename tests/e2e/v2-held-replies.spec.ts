import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
  { name: "short-mobile", width: 390, height: 600 },
]) {
  test(`${viewport.name} concise held evidence, disclosure and punctuated brand release`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route("https://manufacturer.com/**", (route) => route.abort());
    await page.goto("/");
    const composer = page.getByRole("textbox", { name: "Message", exact: true });
    const send = async (text: string) => {
      const response = page.waitForResponse((response) => response.url().endsWith("/api/turn") && response.request().postDataJSON()?.phase === "prepare");
      await composer.fill(text);
      await page.getByRole("button", { name: "Send message", exact: true }).click();
      const prepared = await (await response).json();
      await expect(page.getByRole("status")).toHaveCount(0);
      return prepared;
    };
    const session = async () => page.request.get("/api/session").then((response) => response.json());
    const calls = async () => (await page.request.get("/api/test-stats").then((response) => response.json())).calls;
    await send("I want to buy a powerbank around $30-40.");
    await send("SGD.");
    await expect(page.getByText("Fixture data. Automated test substitute.", { exact: true })).toBeVisible();
    const original = (await session()).state.messages;
    const paidBefore = await calls();
    await send("Keep it short.");
    await send("What about battery life?");
    const battery = (await session()).state.messages.at(-1);
    expect(battery.text.length).toBeLessThan(850);
    expect(battery.text).toContain("Battery life");
    expect(battery.text).not.toContain("https://");
    expect(battery.detail).toContain("up to 12 hours battery life");
    expect(battery.detail).toContain("tax included");
    await expect(page.getByText(battery.text, { exact: true })).toBeInViewport();
    const disclosure = page.getByRole("button", { name: "Full evidence and conditions", exact: true }).last();
    await expect(disclosure).toHaveAttribute("aria-expanded", "false");
    const directory = "artifacts/fieldnote-v4/e2e/held-replies";
    await mkdir(directory, { recursive: true });
    await page.screenshot({ path: `${directory}/${viewport.name}-battery-concise.png` });
    await disclosure.scrollIntoViewIfNeeded();
    await disclosure.focus();
    await page.keyboard.press("Enter");
    await expect(disclosure).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText(battery.detail, { exact: true })).toBeVisible();
    await page.screenshot({ path: `${directory}/${viewport.name}-battery-details.png` });
    await page.keyboard.press("Enter");
    await expect(disclosure).toHaveAttribute("aria-expanded", "false");
    await send("Compare the first two.");
    const comparison = (await session()).state.messages.at(-1);
    expect(comparison.text).toContain("Fixture Powerbank Model A");
    expect(comparison.text).toContain("Fixture Powerbank Model B");
    expect(comparison.text).not.toContain("Fixture Powerbank Model C");
    expect(comparison.detail).toContain("up to 12 hours battery life");
    const heldCallsAfter = await calls();
    expect(heldCallsAfter).toBe(paidBefore);
    await page.screenshot({ path: `${directory}/${viewport.name}-comparison-concise.png` });
    const control = page.getByRole("button", { name: "Full evidence and conditions", exact: true }).last();
    await control.scrollIntoViewIfNeeded();
    const hit = await control.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const points = [0.15, 0.5, 0.85].flatMap((x) => [0.25, 0.5, 0.75].map((y) => ({ x: rect.left + rect.width * x, y: rect.top + rect.height * y })));
      return { width: rect.width, height: rect.height, unobscured: points.every(({ x, y }) => element.contains(document.elementFromPoint(x, y))) };
    });
    expect(hit.unobscured).toBe(true);
    expect(hit.height).toBeGreaterThanOrEqual(28);
    const composerBox = await composer.boundingBox();
    expect(composerBox!.y + composerBox!.height).toBeLessThan(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await send("Show me more details.");
    const expanded = (await session()).state.messages.at(-1);
    expect(expanded.text).toContain("https://manufacturer.com/model-a");
    expect(await calls()).toBe(paidBefore);
    await send("Only USB-C.");
    await send("No Sony.");
    await send("Only Lumenvale.");
    let current = (await session()).state;
    expect(current.intent.requirements.at(-1)).toMatchObject({ kind: "brand", text: "Only Lumenvale." });
    await send("Show me other brands.");
    current = (await session()).state;
    expect(current.intent.productDescription).not.toContain("Lumenvale");
    expect(current.intent.productDescription).toContain("Only USB-C.");
    expect(current.intent.productDescription).toContain("No Sony.");
    expect(current.intent.budget).toEqual({ minimum: 30, maximum: 40, currency: "SGD" });
    expect(current.messages.slice(0, original.length)).toEqual(original);
    await writeFile(`${directory}/${viewport.name}-proof.json`, JSON.stringify({ applicationCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), sourceStatus: execFileSync("git", ["status", "--porcelain", "--", ".", ":(exclude)artifacts/**"], { encoding: "utf8" }).trim(), viewport, composition: "Actual browser and Hono service with the Exa SDK using a local labeled substitute and in-memory quota.", heldCallsBefore: paidBefore, heldCallsAfter, battery, comparison, disclosureHitTest: hit, acceptedIntentAfterBrandRelease: current.intent, historicalSnapshotsUnchanged: true, limits: ["No live Exa, semantic factuality, merchant availability or account persistence acceptance.", "Independent visual review remains required."] }, null, 2) + "\n");
  });
}
