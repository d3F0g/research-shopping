import { expect, test } from "@playwright/test";
import {
  syntheticAnswer,
  syntheticAssessment,
} from "../fixtures/dynamic-research";
import { normalComposition } from "./support/normal-composition";

test.use({ hasTouch: true });

async function send(page: import("@playwright/test").Page, text: string) {
  await page.getByLabel("Message", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
}

test("runs one normal SDK/Hono assessment, keeps hard criteria across budget edits and ordinary replies search zero times", async ({
  page,
}, testInfo) => {
  const native = JSON.parse(
    JSON.stringify(syntheticAnswer()).replaceAll(
      "Aster Pure 30",
      "Synthetic Aster Pure 30",
    ),
  ) as ReturnType<typeof syntheticAnswer>;
  const transport = await normalComposition(page, testInfo, native);
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await expect(page.getByText("Fixture data", { exact: true })).toHaveCount(
      0,
    );
    await send(
      page,
      "A quiet H13 air purifier under SGD300. Must have washable prefilter.",
    );
    const card = page.getByRole("article", {
      name: "Synthetic Aster Pure 30",
      exact: true,
    });
    await expect(card).toBeVisible();
    await expect(card).toContainText("SGD 249.00");
    await expect(
      page.getByRole("heading", {
        name: "Conditional choice · Synthetic Aster Pure 30",
      }),
    ).toBeVisible();
    await expect(card).toContainText("Required · washable prefilter");
    await expect(card).toContainText("Stock and delivery unverified");
    expect(transport.requests).toHaveLength(1);
    expect(transport.requests[0].query).toBe(
      "A quiet H13 air purifier under SGD300. Must have washable prefilter.",
    );
    expect(transport.requests[0].text).toBe(true);
    expect(transport.settlements).toHaveLength(1);
    await card
      .getByRole("button", { name: "Evidence and limits", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(card.getByRole("blockquote").first()).toContainText(
      "H13 air purifier",
    );
    await expect(
      card.getByRole("link", { name: /View product source/ }),
    ).toHaveAttribute("href", "https://reviews.example.com/aster-pure");
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath("sdk-hono-desktop.png"),
      animations: "disabled",
    });
    await send(page, "under SGD200");
    const latest = page.getByTestId("conversation-turn").last();
    await expect(latest).toContainText("No confirmed fit");
    await expect(latest).toContainText("Required · washable prefilter");
    await expect(latest).toContainText("Contradicted");
    expect(transport.requests).toHaveLength(2);
    await expect(page.getByTestId("conversation-turn").first()).toContainText(
      "SGD 249.00",
    );
    await expect(page.getByTestId("conversation-turn").first()).toContainText(
      "Conditional choice",
    );
    await expect(
      page
        .getByTestId("conversation-turn")
        .first()
        .getByRole("button", { name: "Edit preferences" }),
    ).toHaveCount(0);
    await send(page, "Thanks");
    await expect(page.getByTestId("conversation-turn").last()).toContainText(
      "You're welcome",
    );
    expect(transport.requests).toHaveLength(2);
    await expect(
      page
        .getByTestId("conversation-turn")
        .last()
        .locator(".tool-activity, .product-card, .question-card"),
    ).toHaveCount(0);
    await send(page, "none of these");
    await expect(page.getByTestId("conversation-turn").last()).toContainText(
      "What should change",
    );
    expect(transport.requests).toHaveLength(2);
    await send(page, "drop something");
    await expect(page.getByTestId("conversation-turn").last()).toContainText(
      "kept every existing hard requirement",
    );
    expect(transport.requests).toHaveLength(2);
    await page.setViewportSize({ width: 390, height: 600 });
    await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
    await page.screenshot({
      path: testInfo.outputPath("sdk-hono-mobile-history.png"),
      animations: "disabled",
    });
  } finally {
    await transport.close();
  }
});

test("compares unfamiliar products and freeform criteria through the normal native answer boundary", async ({
  page,
}, testInfo) => {
  const url = "https://reviews.example.com/synthetic-heliostat";
  const text =
    "Synthetic test evidence only. Synthetic Sol Arc white is a heliostat controller. Its sealed board resists coastal dew. Field repair requires replacing the controller board. The white single unit has an observed price of SGD 349.00. No actual product or offer is established.";
  const assessment = (rationale: string) =>
    syntheticAssessment(text, url, rationale);
  const native = syntheticAnswer();
  native.citations = [
    { url, title: "Synthetic heliostat comparison fixture", text },
  ];
  const product = native.answer.products[0];
  product.id = "synthetic-sol-arc";
  product.name = "Synthetic Sol Arc";
  product.identity = assessment(
    "Synthetic source identifies the selected white controller.",
  );
  product.requestMatch = assessment(
    "The synthetic source describes a heliostat controller for the open request.",
  );
  product.criteria = [
    {
      criterionId: "criterion-1",
      assessment: assessment(
        "The synthetic source describes resistance to coastal dew.",
      ),
    },
    {
      criterionId: "criterion-2",
      assessment: assessment(
        "Repair needs board replacement. Component-level service is not established.",
      ),
    },
  ];
  product.attributes = [
    {
      name: "Field repairability",
      assessment: assessment(
        "A whole board replacement is required in this synthetic fixture.",
      ),
    },
  ];
  product.price!.amount = 349;
  product.price!.assessment = assessment(
    "Synthetic source states SGD 349 for the white single unit.",
  );
  product.budget = assessment(
    "Synthetic observed SGD349 is below SGD500. Merchant verification remains unavailable.",
  );
  native.answer.choice = {
    productId: product.id,
    reasons: [
      { kind: "criterion", criterionId: "criterion-1" },
      { kind: "field", name: "budget" },
    ],
  };
  const other = structuredClone(product);
  other.id = "synthetic-sol-arc-pro";
  other.name = "Synthetic Sol Arc Pro";
  const otherUrl = "https://reviews.example.com/synthetic-heliostat-pro";
  const otherText =
    "Synthetic test evidence only. Synthetic Sol Arc Pro white is a heliostat controller. The selected variant's dew resistance and repair approach are unspecified. The single white unit has a synthetic observed price of SGD 449.00, including tax. No real offer is established.";
  native.citations.push({
    url: otherUrl,
    title: "Synthetic Sol Arc Pro fixture",
    text: otherText,
  });
  other.identity = syntheticAssessment(
    otherText,
    otherUrl,
    "Synthetic source identifies the white Pro controller.",
  );
  other.price!.amount = 449;
  other.price!.assessment = syntheticAssessment(
    otherText,
    otherUrl,
    "Synthetic source states SGD449 for the selected white Pro unit.",
  );
  other.budget = syntheticAssessment(
    otherText,
    otherUrl,
    "Synthetic observed SGD449 is below the SGD500 limit. Current affordability unverified.",
  );
  other.attributes[0].assessment = {
    ...syntheticAssessment(
      otherText,
      otherUrl,
      "The synthetic source does not establish repairability for the Pro variant.",
    ),
    status: "unknown",
    support: [],
  };

  other.requestMatch = {
    ...assessment(
      "The synthetic evidence does not establish whether the Pro variant meets the heliostat request.",
    ),
    status: "unknown",
    support: [],
  };
  other.criteria[0].assessment = {
    ...assessment(
      "Dew resistance has not been established for the Pro variant.",
    ),
    status: "unknown",
    support: [],
  };
  native.answer.products.push(other);
  const transport = await normalComposition(page, testInfo, native);
  try {
    await page.goto("/");
    await send(
      page,
      "A heliostat controller under SGD500. Must resist coastal dew. Compare field repairability.",
    );
    const first = page.getByRole("article", {
      name: "Synthetic Sol Arc",
      exact: true,
    });
    const second = page.getByRole("article", {
      name: "Synthetic Sol Arc Pro",
      exact: true,
    });
    await expect(first).toContainText("Required · resist coastal dew");
    await expect(first).toContainText("Flexible · field repairability");
    await expect(second).toContainText("Match to your request");
    await expect(second).toContainText("Unknown");
    await expect(
      page.getByRole("heading", {
        name: "Conditional choice · Synthetic Sol Arc",
        exact: true,
      }),
    ).toBeVisible();
    expect(transport.requests).toHaveLength(1);
    await page.setViewportSize({ width: 390, height: 844 });
    await first.scrollIntoViewIfNeeded();
    await first
      .getByRole("button", { name: "Evidence and limits", exact: true })
      .tap();
    await expect(first).toContainText("Literal source passage");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
    await page.screenshot({
      path: testInfo.outputPath("sdk-hono-unfamiliar-mobile.png"),
      animations: "disabled",
    });
  } finally {
    await transport.close();
  }
});

test("asks and validates an optional budget on the server-owned path before one explicit comparison", async ({
  page,
}, testInfo) => {
  const transport = await normalComposition(page, testInfo, syntheticAnswer());
  try {
    await page.goto("/");
    await send(page, "A quiet H13 air purifier. Must have washable prefilter.");
    await expect(
      page.getByRole("heading", { name: "Any budget in mind?" }),
    ).toBeVisible();
    expect(transport.requests).toHaveLength(0);
    await page.getByLabel("Budget amount", { exact: true }).fill("0");
    await page
      .getByRole("button", { name: "Apply budget", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("positive amount");
    expect(transport.requests).toHaveLength(0);
    await page.getByLabel("Budget amount", { exact: true }).fill("250");
    await page
      .getByRole("button", { name: "Apply budget", exact: true })
      .click();
    await expect(
      page.getByRole("article", { name: "Aster Pure 30", exact: true }),
    ).toBeVisible();
    expect(transport.requests).toHaveLength(1);
    await expect(
      page.getByRole("button", { name: "Skip budget", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "New chat" }).click();
    await send(page, "A quiet H13 air purifier. Must have washable prefilter.");
    await page
      .getByRole("button", { name: "Skip budget", exact: true })
      .click();
    await expect(page.getByTestId("conversation-turn").last()).toContainText(
      "Aster Pure 30",
    );
    expect(transport.requests).toHaveLength(2);
  } finally {
    await transport.close();
  }
});
