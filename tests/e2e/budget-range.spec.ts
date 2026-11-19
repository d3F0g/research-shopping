import { expect, test, type Page } from "@playwright/test";
import { syntheticAnswer } from "../fixtures/dynamic-research";
import { actualComposition } from "./support/actual-composition";

async function send(page: Page, message: string) {
  await page.getByLabel("Message", { exact: true }).fill(message);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByTestId("conversation-turn").last()).toHaveAttribute(
    "data-active",
    "true",
  );
}

test("accepts necklace ranges through actual server and SDK, preserves editor bounds and keeps quota failures honest", async ({
  page,
}, testInfo) => {
  const native = JSON.parse(
    JSON.stringify(syntheticAnswer())
      .replaceAll("Aster Pure 30", "Synthetic Silver Link Necklace")
      .replaceAll("white", "45 cm")
      .replaceAll(
        "an H13 air purifier for rooms up to 30 square metres",
        "a sterling silver necklace with a 45 cm chain",
      )
      .replaceAll("249.00", "1499.00"),
  );
  const product = native.answer.products[0];
  product.price.amount = 1499;
  product.criteria = [];
  product.requestMatch.rationale =
    "Synthetic source describes the requested necklace variant. No live recommendation is established.";
  product.attributes = [
    {
      name: "Chain length",
      assessment: {
        ...product.identity,
        rationale:
          "Synthetic source states a 45 cm chain. No live merchant check.",
      },
    },
  ];
  native.citations[0].text = native.citations[0].text
    .split("\n")
    .filter((_: string, index: number) => index !== 1)
    .join("\n");
  product.budget.rationale =
    "Synthetic observed price is within the requested fixture interval.";
  native.answer.choice.reasons = [
    { kind: "field", name: "identity" },
    { kind: "field", name: "price" },
  ];
  const transport = await actualComposition(page, testInfo, native);
  const last = () => page.getByTestId("conversation-turn").last();
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(transport.baseUrl);
    await send(page, "Necklaces between 1k to 2k");
    await expect(last().locator(".intent-summary > p")).toHaveText(
      "SGD 1,000–2,000",
    );
    await expect(last()).toContainText(
      "The amount without a currency uses SGD.",
    );
    await expect(
      last().getByRole("heading", { name: "Any budget in mind?" }),
    ).toHaveCount(0);
    expect(transport.sdkRequests).toHaveLength(1);
    expect(transport.requests[0].phase).toBe("prepare");
    expect(transport.requests[1]).toMatchObject({
      phase: "research",
      preferences: {
        version: 5,
        budget: { minimum: 1000, amount: 2000, currency: "SGD" },
      },
    });
    await last()
      .getByRole("button", { name: "Edit preferences", exact: true })
      .click();
    await expect(
      page.getByLabel("Minimum budget amount", { exact: true }),
    ).toHaveValue("1000");
    await expect(
      page.getByLabel("Maximum budget amount", { exact: true }),
    ).toHaveValue("2000");
    await page.getByLabel("Minimum budget amount", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath("desktop-range-editor.png"),
    });
    await page.setViewportSize({ width: 390, height: 600 });
    await page
      .getByLabel("Minimum budget amount", { exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByLabel("Minimum budget amount", { exact: true }),
    ).toBeInViewport();
    await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
    expect(
      await page.evaluate(() => document.body.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.screenshot({
      path: testInfo.outputPath("mobile-range-editor.png"),
    });
    await page
      .getByLabel("Answer length", { exact: true })
      .selectOption("expanded");
    await page
      .getByRole("button", { name: "Save preferences", exact: true })
      .click();
    await expect(last()).toHaveAttribute("data-active", "true");
    await expect(last().locator(".intent-summary > p")).toHaveText(
      "SGD 1,000–2,000",
    );
    expect(transport.sdkRequests).toHaveLength(1);
    expect(transport.requests.at(-1)).toMatchObject({
      edit: {
        kind: "batch",
        edits: [{ kind: "set-response-length", value: "expanded" }],
      },
    });
    await send(page, "under 1.5k");
    expect(transport.sdkRequests).toHaveLength(2);
    expect(transport.requests.at(-1)).toMatchObject({
      preferences: { budget: { minimum: 1000, amount: 1500, currency: "SGD" } },
    });
    await last()
      .getByRole("button", { name: "Edit preferences", exact: true })
      .click();
    await page
      .getByLabel("Minimum budget amount", { exact: true })
      .fill("1600");
    await page
      .getByRole("button", { name: "Save preferences", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "minimum cannot exceed the maximum",
    );
    expect(transport.sdkRequests).toHaveLength(2);
    await page.getByLabel("Minimum budget amount", { exact: true }).fill("");
    await page
      .getByRole("button", { name: "Save preferences", exact: true })
      .click();
    await expect(last()).toHaveAttribute("data-active", "true");
    expect(transport.requests.at(-1)).toMatchObject({
      edit: {
        edits: [
          { kind: "set-budget", value: { amount: 1500, currency: "SGD" } },
        ],
      },
    });
    transport.pauseResearch();
    await page.getByRole("button", { name: "New chat", exact: true }).click();
    await send(page, "Pottery wheels between 3k and 4k");
    await expect(last().locator(".intent-summary > p")).toHaveText(
      "SGD 3,000–4,000",
    );
    await expect(last()).toContainText(
      "Research is paused by the app's local usage safeguard.",
    );
    await expect(last().getByRole("article")).toHaveCount(0);
    expect(transport.sdkRequests).toHaveLength(2);
    await page.screenshot({
      path: testInfo.outputPath("mobile-quota-range.png"),
    });
  } finally {
    await transport.close();
  }
});
