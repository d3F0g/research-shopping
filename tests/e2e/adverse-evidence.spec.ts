import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";
import { createApp } from "../../src/server/app";
import { createExaProductResearch } from "../../src/server/exa-research";
import { createResearchTurns } from "../../src/server/research-turns";
import { adverseHeading, adversePayload } from "../fixtures/adverse-evidence";

const scenarios: { name: string; cut: string | null; suffix: string; conditional: boolean; wireless: boolean; text?: string; noProduct?: boolean; facts?: string[] }[] = [
  { name: "unverified observed price", cut: null, suffix: "", conditional: false, wireless: false },
  { name: "withheld conditional price", cut: null, suffix: "\nWith trade-in of a qualifying device.", conditional: true, wireless: false },
  { name: "withheld condition heading", cut: null, suffix: "\n## With trade-in of a qualifying device", conditional: true, wireless: false },
  { name: "withheld payment section", cut: null, suffix: "\n## Terms\nWith trade-in of a qualifying device.", conditional: true, wireless: false },
  { name: "unknown narrower property", cut: null, suffix: "\nAster Wave 2 does not have wireless charging.", conditional: false, wireless: true },
  { name: "unknown negated absence", cut: null, suffix: "\nAster Wave 2 is not without Bluetooth.", conditional: false, wireless: true },
  { name: "unknown scan-cut property", cut: "Aster Wave 2 does not have wireless", suffix: " charging.", conditional: true, wireless: true },
  { name: "withheld scan-cut amount", cut: "Price: SGD 349", suffix: " with trade-in.", conditional: true, wireless: false },
  { name: "unknown wrapped property", cut: null, suffix: "\nWireless: No\nCharging support.", conditional: true, wireless: true },
  { name: "unproven clipped identity", cut: null, suffix: "", conditional: true, wireless: false, noProduct: true, text: " ".repeat(16384 - adverseHeading.length - 1) + adverseHeading + "\ncases." },
  { name: "unknown gap property", cut: null, suffix: "\nWireless: No\n... charging support.", conditional: true, wireless: true },
  { name: "withheld gap amount", cut: null, suffix: "", conditional: true, wireless: false, text: adverseHeading + "\n## Specifications\nPrice: SGD 349\n... per month for 12 months." },
  { name: "unproven gap identity", cut: null, suffix: "", conditional: true, wireless: false, noProduct: true, text: adverseHeading + "\n... cases." },
  { name: "period category own fields", cut: null, suffix: "", conditional: false, wireless: false, text: adverseHeading + ".\nDriver size: 42 mm.\nPrice: SGD 349", facts: ["Driver size: 42 mm."] },
  { name: "period category hard exclusion", cut: null, suffix: "", conditional: true, wireless: true, noProduct: true, text: adverseHeading + ".\nWireless: No" },
  { name: "CRLF section completed price", cut: null, suffix: "", conditional: false, wireless: false, text: adverseHeading.replaceAll("\n", "\r\n") + "\r\n## Specifications\r\nPrice: SGD 349\r\n## Specifications\r\n... per month for 12 months." },
  { name: "unproven wrapped category", cut: null, suffix: "", conditional: true, wireless: false, noProduct: true, text: adverseHeading + "\nFor replacement pads." },
];
for (const scenario of scenarios) {
  test(`shows ${scenario.name} through the SDK and Hono with responsive uncertainty`, async ({ page }, testInfo) => {
    const price = "Price: SGD 349";
    const base = `${adverseHeading}\n${price}\nAster Wave 2 supports Bluetooth.`;
    const cutPrefix = scenario.wireless ? base + "\n" : adverseHeading + "\n";
    const text = scenario.text ?? (scenario.cut !== null
      ? cutPrefix + " ".repeat(16384 - cutPrefix.length - scenario.cut.length) + scenario.cut + scenario.suffix
      : base + scenario.suffix);
    const payload = adversePayload("heading", [text], { price, facts: scenario.facts });
    let calls = 0;
    let settlements = 0;
    const server = createServer((incoming, outgoing) => {
      incoming.resume();
      incoming.on("end", () => {
        calls++;
        outgoing.writeHead(200, { "Content-Type": "application/json" });
        outgoing.end(JSON.stringify(payload));
      });
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const app = createApp({ researchTurns: createResearchTurns({
        research: createExaProductResearch("fake-key-local-only", { baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }),
        quota: { async reserve() { return "admitted"; }, async settle() { settlements++; } },
      }) }, { apiPort: 6397, webPort: 6398 });
      await page.route("**/api/turn", async (route) => {
        const response = await app.request("http://127.0.0.1:6397/api/turn", { method: "POST", headers: { "Content-Type": "application/json" }, body: route.request().postData() });
        const result = await response.json();
        result.answer = `Automated synthetic fixture. No live products, prices or stock. ${result.answer}`;
        await route.fulfill({ status: response.status, json: result });
      });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto("/");
      await expect(page.locator("html")).toHaveClass(/dark/);
      await page.getByLabel("Message", { exact: true }).fill(scenario.wireless ? "Wireless headphones under SGD400" : "Headphones under SGD400");
      await page.getByRole("button", { name: "Send message" }).click();
      const card = page.getByRole("article", { name: "Aster Wave 2", exact: true });
      await expect(page.getByText(/Automated synthetic fixture/)).toBeVisible();
      if (scenario.noProduct) {
        await expect(card).toHaveCount(0);
        await page.getByRole("button", { name: "1 research sources" }).click();
        await expect(page.locator(".web-research-highlights > li").first()).toBeVisible();
        const limits = page.getByRole("button", { name: "Research limits" });
        await limits.click();
        await expect(limits).toHaveAttribute("aria-expanded", "true");
        await expect(page.getByText("No product had sufficiently attributable model, category and constraint evidence")).toBeVisible();
        await expect(page.getByRole("button", { name: "Compare research leads" })).toHaveCount(0);
      } else {
        await expect(card).toBeVisible();
        if (scenario.facts?.length) {
          for (const fact of scenario.facts) await expect(card).toContainText(fact);
          await expect(card).not.toContainText("Specifications not established by this source");
        } else await expect(card).toContainText("Specifications not established by this source");
        await expect(card).toContainText("Stock and delivery unverified");
        if (scenario.conditional) {
          await expect(card).not.toContainText("Price: SGD 349");
          await expect(card).not.toContainText("Page-observed price");
        } else {
          await expect(card).toContainText("Price: SGD 349");
          await expect(card).toContainText("Page-observed price · Unverified");
        }
        await card.getByRole("button", { name: "Evidence and limits" }).click();
        await expect(card).toContainText("Current affordability within SGD 400 is unverified");
        if (scenario.wireless) await expect(card).toContainText("wireless needs independent verification");
        for (const link of await card.getByRole("link", { name: /View source/ }).all()) await expect(link).toHaveAttribute("href", payload.results[0].url);
      }
      await expect(page.getByRole("button", { name: "Select this product" })).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath("adverse-desktop.png"), fullPage: true, animations: "disabled" });
      await page.setViewportSize({ width: 390, height: 844 });
      if (!scenario.noProduct) await card.scrollIntoViewIfNeeded();
      await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
      await page.screenshot({ path: testInfo.outputPath("adverse-mobile.png"), fullPage: true, animations: "disabled" });
      expect(calls).toBe(1);
      expect(settlements).toBe(1);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
}
