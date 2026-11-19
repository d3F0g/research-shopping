import { expect, test, type Page } from "@playwright/test";
import {
  syntheticAnswer,
  syntheticAssessment,
} from "../fixtures/dynamic-research";
import { actualComposition } from "./support/actual-composition";

async function send(page: Page, text: string) {
  await page.getByLabel("Message", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByTestId("conversation-turn").last()).toHaveAttribute(
    "data-active",
    "true",
  );
}

test("discloses paid submission and completes server-ranked shopping with local help over actual HTTP", async ({
  page,
}, testInfo) => {
  const payload = syntheticAnswer();
  const weaker = structuredClone(payload.answer.products[0]!);
  weaker.id = "synthetic-alternative";
  weaker.name = "Synthetic alternative";
  const stronger = payload.answer.products[0]!;
  stronger.name = "Synthetic Aster Pure 30";
  const quote = "Aster Pure 30 white has a low power mode.";
  payload.citations[0]!.text += `\n${quote}`;
  stronger.criteria.push({
    criterionId: "criterion-2",
    assessment: syntheticAssessment(
      quote,
      undefined,
      "The source supports low power mode.",
    ),
  });
  weaker.criteria.push({
    criterionId: "criterion-2",
    assessment: {
      ...syntheticAssessment(quote),
      status: "unknown",
      support: [],
      rationale: "Low power mode was not established.",
    },
  });
  payload.answer.products = [weaker, stronger];
  payload.answer.choice = null;
  const transport = await actualComposition(page, testInfo, (body: Record<string, unknown>) => {
    const intent = JSON.parse(String(body.systemPrompt).split("Current authoritative shopping intent: ")[1]);
    const preference = intent.criteria.find((criterion: { wording: string }) => criterion.wording === "low power");
    const result = structuredClone(payload);
    for (const product of result.answer.products)
      product.criteria[1].criterionId = preference.id;
    return result;
  });
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(transport.baseUrl);
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.locator(".composer-note")).toContainText(
      "one paid Exa call",
    );
    await page.screenshot({
      path: testInfo.outputPath("paid-disclosure-desktop.png"),
      animations: "disabled",
    });
    await send(page, "How does this work?");
    await expect(page.getByTestId("conversation-turn").last()).toContainText(
      "shopping",
    );
    expect(transport.sdkRequests).toHaveLength(0);
    await send(
      page,
      "A quiet H13 air purifier under SGD300. Must have washable prefilter. Prefer low power.",
    );
    expect(transport.sdkRequests).toHaveLength(1);
    const shopping = page.getByTestId("conversation-turn").nth(1);
    await expect(
      shopping.getByRole("heading", {
        name: "Conditional choice · Synthetic Aster Pure 30",
      }),
    ).toBeVisible();
    await expect(shopping.getByRole("article").first()).toHaveAccessibleName(
      "Synthetic Aster Pure 30",
    );
    await expect(shopping.getByRole("article").nth(1)).toContainText(
      "Tradeoffs and unknowns",
    );
    await expect(shopping).not.toContainText("criterion-2");
    const firstCard = shopping.getByRole("article").first();
    await expect(firstCard.locator(".attribute-preview")).toContainText(
      "Its stated coverage is up to 30 square metres; actual conditions may differ.",
    );
    await expect(firstCard.locator(".attribute-preview")).toBeVisible();
    for (const label of [
      "Product identity",
      "Match to your request",
      "Observed price",
      "Observed budget comparison",
    ]) {
      await expect(
        firstCard
          .locator(".compact-assessments dt")
          .getByText(label, { exact: true }),
      ).toHaveCount(0);
    }
    await expect(shopping.locator(".answer-first")).not.toContainText(
      "Order reflects",
    );
    await shopping
      .getByRole("button", { name: "Research limits", exact: true })
      .click();
    await expect(
      shopping.getByText(/Order reflects hard eligibility/),
    ).toBeVisible();
    await shopping
      .getByRole("button", { name: "Research limits", exact: true })
      .click();
    await shopping
      .getByRole("button", { name: "Evidence and limits", exact: true })
      .first()
      .click();
    await expect(
      shopping.getByText("Literal source passage").first(),
    ).toBeVisible();
    expect(transport.sdkRequests).toHaveLength(1);
    await shopping
      .getByRole("button", { name: "Evidence and limits", exact: true })
      .first()
      .click();
    await shopping.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath("ranked-comparison-desktop.png"),
      animations: "disabled",
    });
    await page.setViewportSize({ width: 390, height: 600 });
    await shopping.getByRole("article").nth(1).scrollIntoViewIfNeeded();
    await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
    expect(
      await page.evaluate(() => document.body.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.screenshot({
      path: testInfo.outputPath("ranked-tradeoffs-mobile.png"),
      animations: "disabled",
    });
    await send(page, "Thanks");
    await send(page, "Does this cost money?");
    expect(transport.sdkRequests).toHaveLength(1);
    await send(page, "under CHF200");
    await send(page, "What can you do?");
    await expect(page.locator(".pending-change-preview")).toHaveText(
      "under CHF200",
    );
    expect(transport.sdkRequests).toHaveLength(1);
    await expect(
      shopping.getByRole("heading", { name: /Conditional choice/ }),
    ).toBeAttached();
    const replies = transport.responses as {
      kind: string;
      preferences?: unknown;
    }[];
    const original = replies.find(
      (reply) => reply.kind === "research",
    )!.preferences;
    const help = replies.filter((reply) => reply.kind === "message").at(-2)!;
    expect(help.preferences).toEqual(original);
    await expect(
      page.getByRole("button", { name: "New chat", exact: true }),
    ).toBeInViewport({ ratio: 1 });
    await page.screenshot({
      path: testInfo.outputPath("local-help-pending-mobile.png"),
      animations: "disabled",
    });
  } finally {
    await transport.close();
  }
});
