import { expect, test, type Page } from "@playwright/test";
import { actualComposition } from "./support/actual-composition";

const initialRequest =
  "A quiet H13 air purifier under SGD400. Must have washable prefilter.";
async function send(page: Page, text: string) {
  await page.getByLabel("Message", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
}
async function completed(page: Page) {
  await expect(page.getByTestId("conversation-turn").last()).toHaveAttribute(
    "data-active",
    "true",
  );
}
function sdkIntent(body: Record<string, unknown>) {
  return JSON.parse(
    String(body.systemPrompt).split(
      "Current authoritative shopping intent: ",
    )[1],
  ) as {
    budget: { amount: number; currency: string } | null;
    criteria: { wording: string; strength: string }[];
    pendingChange: unknown;
  };
}

test("keeps an invalid hard budget change pending across thanks and refresh until correction or explicit discard", async ({
  page,
}, testInfo) => {
  const transport = await actualComposition(page, testInfo);
  try {
    await page.goto(transport.baseUrl);
    await send(page, initialRequest);
    await completed(page);
    expect(transport.sdkRequests).toHaveLength(1);
    await send(page, "under 200CHF");
    await completed(page);
    await expect(
      page.getByText("Resolve this change before researching", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".pending-change-preview")).toHaveText(
      "under 200CHF",
    );
    expect(transport.sdkRequests).toHaveLength(1);
    await send(page, "Thanks");
    await completed(page);
    await expect(page.locator(".pending-change-preview")).toHaveText(
      "under 200CHF",
    );
    await send(page, "refresh");
    await completed(page);
    expect(transport.sdkRequests).toHaveLength(1);
    await expect(
      page.getByTestId("conversation-turn").last().getByRole("article"),
    ).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 600 });
    await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
    expect(
      await page.evaluate(() => document.body.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.screenshot({
      path: testInfo.outputPath("pending-invalid-mobile.png"),
      animations: "disabled",
    });
    await page
      .getByRole("button", { name: "Resolve change", exact: true })
      .click();
    await expect(page.getByLabel("Message", { exact: true })).toHaveValue(
      "under 200CHF",
    );
    await expect(page.getByLabel("Message", { exact: true })).toBeFocused();
    await send(page, "under SGD200");
    await completed(page);
    expect(transport.sdkRequests).toHaveLength(2);
    expect(sdkIntent(transport.sdkRequests[1]).budget).toEqual({
      amount: 200,
      currency: "SGD",
    });
    expect(sdkIntent(transport.sdkRequests[1]).criteria).toContainEqual(
      expect.objectContaining({
        wording: "washable prefilter",
        strength: "hard",
      }),
    );
    await expect(page.locator(".pending-change")).toHaveCount(0);
    await send(page, "under 100CHF");
    await completed(page);
    await page
      .getByRole("button", { name: "Discard pending change", exact: true })
      .click();
    await completed(page);
    expect(transport.sdkRequests).toHaveLength(2);
    await expect(page.locator(".pending-change")).toHaveCount(0);
    await send(page, "refresh");
    await completed(page);
    expect(transport.sdkRequests).toHaveLength(3);
    expect(sdkIntent(transport.sdkRequests[2]).budget).toEqual({
      amount: 200,
      currency: "SGD",
    });
  } finally {
    await transport.close();
  }
});

test("commits prepared exclusions before SDK work and retains them after Stop, a new turn and explicit retry", async ({
  page,
}, testInfo) => {
  const transport = await actualComposition(page, testInfo);
  try {
    await page.goto(transport.baseUrl);
    await send(page, initialRequest);
    await completed(page);
    transport.deferNext();
    await send(page, "Exclude Aster");
    await expect.poll(() => transport.sdkRequests.length).toBe(2);
    expect(sdkIntent(transport.sdkRequests[1]).criteria).toContainEqual(
      expect.objectContaining({ wording: "Exclude Aster", strength: "hard" }),
    );
    await expect(
      page
        .getByTestId("conversation-turn")
        .last()
        .locator(".ordinary-message, .answer-first"),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Stop response", exact: true })
      .click();
    await expect(page.getByTestId("conversation-turn").last()).toContainText(
      "Response stopped.",
    );
    await expect.poll(() => transport.aborts).toBe(1);
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await completed(page);
    expect(transport.sdkRequests).toHaveLength(3);
    expect(sdkIntent(transport.sdkRequests[2]).criteria).toContainEqual(
      expect.objectContaining({ wording: "Exclude Aster", strength: "hard" }),
    );
    const retry = transport.requests.at(-1)!;
    expect(retry.phase).toBe("research");
    expect(retry).not.toHaveProperty("message");
    await send(page, "Compare options");
    await completed(page);
    expect(transport.sdkRequests).toHaveLength(4);
    expect(sdkIntent(transport.sdkRequests[3]).criteria).toEqual(
      sdkIntent(transport.sdkRequests[1]).criteria,
    );
    expect(sdkIntent(transport.sdkRequests[3]).criteria).toContainEqual(
      expect.objectContaining({ wording: "Exclude Aster", strength: "hard" }),
    );
    await expect(
      page
        .getByTestId("conversation-turn")
        .last()
        .getByRole("heading", { name: /Conditional choice/ }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "New chat", exact: true }).click();
    await send(page, initialRequest);
    await completed(page);
    expect(transport.sdkRequests).toHaveLength(5);
    expect(
      sdkIntent(transport.sdkRequests[4]).criteria.some(
        (criterion) => criterion.wording === "Exclude Aster",
      ),
    ).toBe(false);
    await expect(
      page
        .getByTestId("conversation-turn")
        .last()
        .getByRole("heading", { name: /Conditional choice/ }),
    ).toBeVisible();
  } finally {
    await transport.close();
  }
});
