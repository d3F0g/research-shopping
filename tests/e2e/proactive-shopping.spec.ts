import { expect, test, type Page } from "@playwright/test";
import { syntheticAnswer, syntheticAssessment } from "../fixtures/dynamic-research";
import { actualComposition } from "./support/actual-composition";

const request = "I want to buy a powerbank that costs around $30-40";

async function send(page: Page, message: string) {
  await page.getByLabel("Message", { exact: true }).fill(message);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
}

function powerbankAnswer() {
  const native = syntheticAnswer();
  const url = "https://reviews.example.com/synthetic-powerbank";
  const text = "Synthetic automated fixture only. Synthetic Pocket 10 black is a portable powerbank. The single black unit has an observed fixture price of SGD 35.00 including tax. This establishes no real product or merchant offer.";
  const assessment = (rationale: string) => syntheticAssessment(text, url, rationale);
  native.citations = [{ url, title: "Synthetic powerbank fixture", text }];
  const product = native.answer.products[0];
  product.id = "synthetic-pocket-10";
  product.name = "Synthetic Pocket 10";
  product.variant = "black";
  product.identity = assessment("Synthetic source identifies the black powerbank.");
  product.requestMatch = assessment("Synthetic source describes a portable powerbank.");
  product.criteria = [];
  product.attributes = [];
  product.price = {
    amount: 35, currency: "SGD", variant: "black",
    conditions: ["Synthetic fixture only", "Single unit", "Tax included"],
    conditionsResolved: true,
    assessment: assessment("Synthetic source states SGD35 for the single black unit."),
  };
  product.budget = assessment("Synthetic observed SGD35 is within SGD30 to SGD40.");
  native.answer.choice = { productId: product.id, reasons: [{ kind: "field", name: "budget" }] };
  return native;
}

for (const currency of ["SGD", "S$", "SGD$30"]) {
  test(`retains the original 30 to 40 range after ${currency} and automatically researches`, async ({ page }, testInfo) => {
    const transport = await actualComposition(page, testInfo, powerbankAnswer());
    try {
      await page.goto(transport.baseUrl);
      await send(page, request);
      await expect(page.getByTestId("conversation-turn").last()).toContainText("SGD or USD");
      expect(transport.sdkRequests).toHaveLength(0);
      await send(page, currency);
      const latest = page.getByTestId("conversation-turn").last();
      await expect(latest.getByRole("heading", { name: "Conditional choice · Synthetic Pocket 10", exact: true })).toBeVisible();
      await expect(latest.locator(".intent-summary > p")).toHaveText("SGD 30–40");
      expect(transport.sdkRequests).toHaveLength(1);
      expect(transport.requests.filter((turn) => turn.phase === "research")).toEqual([
        expect.objectContaining({ preferences: expect.objectContaining({ budget: { minimum: 30, amount: 40, currency: "SGD" }, pendingChange: null }) }),
      ]);
      await expect(page.getByTestId("user-message")).toHaveText([request, currency]);
      await expect(page.locator(".pending-change, .question-card")).toHaveCount(0);
    } finally {
      await transport.close();
    }
  });
}
