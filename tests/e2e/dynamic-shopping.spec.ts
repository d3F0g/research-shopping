import { expect, test, type Page } from "@playwright/test";
import {
  defaultIntent,
  type PrepareTurnRequest as TurnRequest,
} from "../../src/domain/contracts";
import { syntheticComparison } from "./support/dynamic-fixture";

function response(research = syntheticComparison()) {
  return {
    responseVersion: 5 as const,
    kind: "research" as const,
    answer: research.summary,
    preferences: research.intent,
    notes: [],
    research,
  };
}
async function fixtureHealth(page: Page) {
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: { status: "ok", mode: "fixture", liveIntegrations: false },
    }),
  );
}
async function send(page: Page, text: string) {
  await page.getByLabel("Message", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
}
const request =
  "Archival slide scanner under SGD500. Must preserve edge detail.";

test("opens a minimal dark chat and persists both theme choices", async ({
  page,
}) => {
  await fixtureHealth(page);
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(
    page.getByRole("heading", { name: "What are you looking for?" }),
  ).toBeVisible();
  await expect(page.getByRole("complementary")).toHaveCount(0);
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.locator(".preferences-panel")).toHaveCount(0);
  await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight),
  ).toBeLessThanOrEqual(900);
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/light/);
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.evaluate(() => localStorage.setItem("fieldnote-theme", "invalid"));
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByLabel("Message", { exact: true }).focus();
  await expect(page.getByLabel("Message", { exact: true })).toBeFocused();
  expect(
    await page
      .getByLabel("Message", { exact: true })
      .evaluate((element) => getComputedStyle(element).outlineWidth),
  ).not.toBe("0px");
});

test("shows useful synthetic comparison, literal evidence, safe sources and responsive composer", async ({
  page,
}, testInfo) => {
  await fixtureHealth(page);
  let calls = 0;
  await page.route("**/api/turn", (route) => {
    calls++;
    return route.fulfill({ json: response() });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await send(page, request);
  const aster = page.getByRole("article", {
    name: "Synthetic Aster Scan",
    exact: true,
  });
  const orbit = page.getByRole("article", {
    name: "Synthetic Orbit Scan",
    exact: true,
  });
  await expect(aster).toContainText("SGD 299.00");
  await expect(aster).toContainText("Stock and delivery unverified");
  await expect(orbit).toContainText("Unknown");
  await expect(
    page.getByRole("heading", {
      name: "Conditional choice · Synthetic Aster Scan",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Source-based AI assessment", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Select this product" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("desktop-default.png"),
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 600 });
  await aster.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("mobile-default.png"),
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await aster
    .getByRole("button", { name: "Evidence and limits", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(aster.getByRole("blockquote").first()).toHaveText(
    syntheticComparison().sources[0].text,
  );
  await expect(
    aster.getByRole("link", { name: /View product source/ }),
  ).toHaveAttribute("href", syntheticComparison().sources[0].url);
  await expect(
    aster.getByRole("link", { name: /View product source/ }),
  ).toHaveAttribute("rel", "noopener noreferrer");
  await aster
    .getByRole("button", { name: /Preview source/ })
    .first()
    .focus();
  await expect(
    page
      .locator(".citation-preview")
      .getByRole("link", { name: /View source/ }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".citation-preview")).not.toBeVisible();
  await aster.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("desktop-evidence.png"),
    animations: "disabled",
  });
  for (const height of [844, 600]) {
    await page.setViewportSize({ width: 390, height });
    await aster.scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    expect(
      await page.evaluate(() => document.body.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
    await page.screenshot({
      path: testInfo.outputPath(`mobile-${height}-evidence.png`),
      animations: "disabled",
    });
  }
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.screenshot({
    path: testInfo.outputPath("mobile-light.png"),
    animations: "disabled",
  });
  await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
  expect(calls).toBe(1);
});

test("sends original language without a client parser and asks only the server's budget question", async ({
  page,
}) => {
  await fixtureHealth(page);
  const requests: TurnRequest[] = [];
  const preferences = {
    ...defaultIntent(),
    productDescription: "A heliostat controller with dew resilience",
    revision: 1,
  };
  await page.route("**/api/turn", (route) => {
    const incoming = route.request().postDataJSON() as TurnRequest;
    requests.push(incoming);
    return route.fulfill({
      json: incoming.skipBudget
        ? {
            responseVersion: 5,
            kind: "research-unavailable",
            reason: "disabled",
            message: "Synthetic test. Research disabled.",
            preferences: { ...preferences, budgetClarified: true },
            notes: [],
          }
        : {
            responseVersion: 5,
            kind: "question",
            question: "budget",
            message: "Any budget in mind?",
            preferences,
            notes: [],
          },
    });
  });
  await page.goto("/");
  await send(page, preferences.productDescription);
  await expect(
    page.getByRole("heading", { name: "Any budget in mind?" }),
  ).toBeVisible();
  expect(requests[0].preferences).toEqual(defaultIntent());
  expect(requests[0].message).toBe(preferences.productDescription);
  await expect(
    page.getByRole("button", { name: /SGD (150|300|500)/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Skip budget", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Research unavailable" }),
  ).toBeVisible();
  expect(requests[1].skipBudget).toBe(true);
  expect(requests[1].preferences.productDescription).toBe(
    preferences.productDescription,
  );
  await expect(
    page.getByRole("button", { name: "Skip budget", exact: true }),
  ).toHaveCount(0);
});

test("saves explicit stable criterion edits without automatic research and keeps prior snapshots", async ({
  page,
}, testInfo) => {
  await fixtureHealth(page);
  const first = syntheticComparison();
  const requests: TurnRequest[] = [];
  const edited = structuredClone(first.intent);
  edited.productDescription = "A heliostat controller with dew resilience";
  edited.budget = { amount: 450, currency: "SGD" };
  edited.criteria = [
    {
      ...edited.criteria[0],
      wording: "survive coastal dew",
      strength: "flexible",
    },
    {
      id: "criterion-2",
      wording: "accept open-loop calibration",
      strength: "hard",
      origin: { kind: "edit", text: "accept open-loop calibration" },
    },
  ];
  edited.revision++;
  await page.route("**/api/turn", (route) => {
    const incoming = route.request().postDataJSON() as TurnRequest;
    requests.push(incoming);
    return route.fulfill({
      json: incoming.edit
        ? {
            responseVersion: 5,
            kind: "message",
            message: "Synthetic test. Preferences updated without research.",
            preferences: edited,
            notes: [],
          }
        : requests.length === 1
          ? response(first)
          : {
              responseVersion: 5,
              kind: "research-unavailable",
              message: "Synthetic test. Explicit comparison requested.",
              reason: "disabled",
              preferences: edited,
              notes: [],
            },
    });
  });
  await page.setViewportSize({ width: 390, height: 600 });
  await page.goto("/");
  await send(page, request);
  await page
    .getByRole("button", { name: "Edit preferences", exact: true })
    .click();
  await page
    .getByLabel("What you're looking for", { exact: true })
    .fill(edited.productDescription);
  await page
    .getByLabel("Criterion 1", { exact: true })
    .fill("survive coastal dew");
  await page
    .getByLabel("Importance for criterion 1", { exact: true })
    .selectOption("flexible");
  await page
    .getByRole("button", { name: "Add criterion", exact: true })
    .click();
  await page
    .getByLabel("Criterion 2", { exact: true })
    .fill("accept open-loop calibration");
  await page
    .getByLabel("Importance for criterion 2", { exact: true })
    .selectOption("hard");
  await page.getByLabel("Maximum budget amount", { exact: true }).fill("450");
  await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
  expect(
    await page.evaluate(() => document.body.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("mobile-editor.png"),
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect(
    page.getByText("Synthetic test. Preferences updated without research."),
  ).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1].edit).toEqual({
    kind: "batch",
    edits: [
      { kind: "set-description", value: edited.productDescription },
      { kind: "set-budget", value: { amount: 450, currency: "SGD" } },
      {
        kind: "replace-criterion",
        id: "criterion-1",
        wording: "survive coastal dew",
        strength: "flexible",
      },
      {
        kind: "add-criterion",
        wording: "accept open-loop calibration",
        strength: "hard",
      },
    ],
  });
  await expect(page.getByTestId("conversation-turn").first()).toContainText(
    "preserve edge detail",
  );
  await expect(page.getByTestId("conversation-turn").first()).toContainText(
    "SGD 299.00",
  );
  await expect(
    page
      .getByTestId("conversation-turn")
      .first()
      .getByRole("button", { name: "Edit preferences" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Compare options", exact: true })
    .click();
  await expect(
    page.getByText("Synthetic test. Explicit comparison requested."),
  ).toBeVisible();
  expect(requests).toHaveLength(3);
  expect(requests[2].preferences).toEqual(edited);
  expect(requests[2].edit).toBeUndefined();
});

test("blocks invalid budget drafts and removes only the explicit criterion", async ({
  page,
}) => {
  await fixtureHealth(page);
  const requests: TurnRequest[] = [];
  await page.route("**/api/turn", (route) => {
    const incoming = route.request().postDataJSON() as TurnRequest;
    requests.push(incoming);
    return route.fulfill({
      json: incoming.edit
        ? {
            responseVersion: 5,
            kind: "message",
            message: "Synthetic edit accepted.",
            preferences: {
              ...syntheticComparison().intent,
              criteria: [],
              budget: null,
            },
            notes: [],
          }
        : response(),
    });
  });
  await page.goto("/");
  await send(page, request);
  await page
    .getByRole("button", { name: "Edit preferences", exact: true })
    .click();
  await page.getByLabel("Maximum budget amount", { exact: true }).fill("0");
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("positive budget");
  expect(requests).toHaveLength(1);
  await expect(
    page.getByRole("article", { name: "Synthetic Aster Scan" }),
  ).toContainText("SGD 299.00");
  await page.getByLabel("Maximum budget amount", { exact: true }).fill("");
  await page.getByRole("button", { name: "Remove criterion 1" }).click();
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect(page.getByText("Synthetic edit accepted.")).toBeVisible();
  expect(requests[1].edit).toEqual({
    kind: "batch",
    edits: [
      { kind: "set-budget", value: null },
      { kind: "remove-criterion", id: "criterion-1" },
    ],
  });
});

test("keeps ordinary replies ordinary and previous results immutable", async ({
  page,
}) => {
  await fixtureHealth(page);
  let calls = 0;
  await page.route("**/api/turn", (route) => {
    calls++;
    return route.fulfill({
      json:
        calls === 1
          ? response()
          : {
              responseVersion: 5,
              kind: "message",
              message: "You're welcome.",
              preferences: syntheticComparison().intent,
              notes: [],
            },
    });
  });
  await page.goto("/");
  await send(page, request);
  await send(page, "Thanks");
  const latest = page.getByTestId("conversation-turn").last();
  await expect(latest).toContainText("You're welcome.");
  await expect(
    latest.locator(
      ".product-card, .tool-activity, .question-card, .intent-summary",
    ),
  ).toHaveCount(0);
  await expect(page.getByTestId("conversation-turn")).toHaveCount(2);
  await expect(page.getByTestId("conversation-turn").first()).toContainText(
    "SGD 299.00",
  );
  await expect(
    page.getByRole("button", { name: "Edit preferences" }),
  ).toHaveCount(0);
  expect(calls).toBe(2);
});

test("renders unknown, contradicted and conflicting evidence without a compliant recommendation", async ({
  page,
}) => {
  await fixtureHealth(page);
  const research = syntheticComparison();
  research.choice = null;
  research.summary =
    "Synthetic comparison only. Neither option has established hard-criterion fit.";
  research.products[0].criteria[0].assessment.status = "contradicted";
  research.products[0].criteria[0].assessment.rationale =
    "Synthetic evidence says the film holder does not preserve edge detail.";
  research.products[0].budget!.status = "conflict";
  research.products[0].budget!.support.push(
    research.products[1].identity.support[0],
  );
  research.products[0].price!.conditionsResolved = false;
  research.products[0].price!.assessment.scope = "product-family";
  research.products[0].price!.conditions = [
    "Synthetic membership offer only",
    "Variant eligibility unresolved",
  ];
  research.products[1].price = null;
  research.products[1].identity.scope = "product-family";
  research.sources[0].text += "\n<script>window.fixtureInjected=true</script>";
  await page.route("**/api/turn", (route) =>
    route.fulfill({ json: response(research) }),
  );
  await page.goto("/");
  await send(page, request);
  await expect(page.getByText(/No confirmed fit/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Conditional choice/ }),
  ).toHaveCount(0);
  const aster = page.getByRole("article", { name: "Synthetic Aster Scan" });
  await expect(aster).toContainText("Contradicted");
  await expect(
    page.getByRole("article", { name: "Synthetic Orbit Scan" }),
  ).toContainText("Product family only");
  await expect(aster).toContainText("Conflicting sources");
  await expect(aster).toContainText("Synthetic membership offer only");
  await expect(aster).toContainText("Price conditions unresolved");
  await expect(aster).toContainText("Variant price not established");
  await expect(aster).toContainText(
    "Page price context · SGD 299.00 · Product family only",
  );
  await page
    .getByRole("button", { name: "2 research sources", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Retained source context", exact: true })
    .first()
    .click();
  await expect(page.locator(".source-context").first()).toContainText(
    "<script>window.fixtureInjected=true</script>",
  );
  expect(await page.evaluate(() => "fixtureInjected" in window)).toBe(false);
  await expect(
    page.getByRole("article", { name: "Synthetic Orbit Scan" }),
  ).toContainText("Price or currency not established");
});

test("rejects malformed, forged, unsafe and unknown-version results before rendering source actions", async ({
  page,
}) => {
  await fixtureHealth(page);
  const cases = [
    () => {
      const result = response();
      result.research.products[0].identity.support[0].quote =
        "Invented passage";
      return result;
    },
    () => {
      const result = response();
      result.research.sources[0].url = "javascript:alert(1)";
      return result;
    },
    () => ({ ...response(), responseVersion: 99 }),
  ];
  for (const make of cases) {
    await page.route("**/api/turn", (route) => route.fulfill({ json: make() }));
    await page.goto("/");
    await send(page, request);
    await expect(page.getByRole("alert")).toContainText("unreadable result");
    await expect(page.getByRole("article")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /View source|View product/ }),
    ).toHaveCount(0);
    await page.unroute("**/api/turn");
  }
  await page.route("**/api/turn", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "<broken-json>",
    }),
  );
  await page.goto("/");
  await send(page, request);
  await expect(page.getByRole("alert")).toContainText("unreadable result");
  await expect(page.getByRole("article")).toHaveCount(0);
});

test("keeps provider failure explicit without sample fallback or merchant actions", async ({
  page,
}) => {
  await fixtureHealth(page);
  await page.route("**/api/turn", (route) =>
    route.fulfill({
      json: {
        responseVersion: 5,
        kind: "research-unavailable",
        reason: "provider-error",
        message: "Synthetic provider error. No research result.",
        preferences: syntheticComparison().intent,
        notes: [],
      },
    }),
  );
  await page.goto("/");
  await send(page, request);
  await expect(
    page.getByRole("heading", { name: "Research unavailable" }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Select this product" }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: /View product/ })).toHaveCount(0);
});

test("cancels transport and discards late results on typing, stop and reset", async ({
  page,
}) => {
  await fixtureHealth(page);
  let release: (() => void) | undefined;
  let started = 0;
  const failures: string[] = [];
  page.on("requestfailed", (request) => {
    if (request.url().includes("/api/turn"))
      failures.push(request.failure()?.errorText ?? "failed");
  });
  await page.route("**/api/turn", async (route) => {
    started++;
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.fulfill({ json: response() }).catch(() => undefined);
  });
  await page.goto("/");
  await send(page, request);
  await expect.poll(() => started).toBe(1);
  await page.getByLabel("Message", { exact: true }).fill("new draft");
  await expect(page.getByText("Response stopped.")).toBeVisible();
  release!();
  await expect.poll(() => failures.length).toBe(1);
  await expect(page.getByRole("article")).toHaveCount(0);
  await send(page, "A different product under SGD50");
  await expect.poll(() => started).toBe(2);
  await page.getByRole("button", { name: "Stop response" }).click();
  release!();
  await expect(
    page.getByRole("button", { name: "Retry", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect.poll(() => started).toBe(3);
  await page.getByRole("button", { name: "New chat" }).click();
  release!();
  await expect(
    page.getByRole("heading", { name: "What are you looking for?" }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByTestId("conversation-turn")).toHaveCount(0);
});

test("recovers network failures with the original request snapshot and isolates browser contexts", async ({
  browser,
}) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  try {
    const page = await a.newPage();
    const other = await b.newPage();
    await fixtureHealth(page);
    await fixtureHealth(other);
    const requests: TurnRequest[] = [];
    await page.route("**/api/turn", (route) => {
      requests.push(route.request().postDataJSON());
      return requests.length === 1
        ? route.abort("failed")
        : route.fulfill({ json: response() });
    });
    await page.goto("/");
    await send(page, request);
    await expect(page.getByRole("alert")).toContainText("Check the connection");
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(
      page.getByRole("article", { name: "Synthetic Aster Scan" }),
    ).toBeVisible();
    expect(requests[1].message).toBe(requests[0].message);
    expect(requests[1].preferences).toEqual(requests[0].preferences);
    expect(requests[1].operationId).toBe(requests[0].operationId);
    await other.goto("/");
    await expect(other.getByTestId("conversation-turn")).toHaveCount(0);
    await expect(
      other.getByRole("heading", { name: "What are you looking for?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "New chat" }).click();
    await expect(page.getByTestId("conversation-turn")).toHaveCount(0);
    await expect(page.getByLabel("Message", { exact: true })).toHaveValue("");
  } finally {
    await a.close();
    await b.close();
  }
});

test("submits with Enter, retains Shift+Enter newlines and scrolls history without losing the mobile composer", async ({
  page,
}) => {
  await fixtureHealth(page);
  const requests: TurnRequest[] = [];
  await page.route("**/api/turn", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({
      json: {
        responseVersion: 5,
        kind: "message",
        message: `Synthetic ordinary reply ${requests.length}. ${"Read the earlier conversation at your own pace. ".repeat(6)}`,
        preferences: defaultIntent(),
        notes: [],
      },
    });
  });
  await page.setViewportSize({ width: 390, height: 600 });
  await page.goto("/");
  const composer = page.getByLabel("Message", { exact: true });
  await composer.fill("first line");
  await composer.press("Shift+Enter");
  await composer.press("x");
  await expect(composer).toHaveValue("first line\nx");
  await composer.press("Enter");
  await expect(page.getByTestId("conversation-turn")).toHaveCount(1);
  expect(requests[0].message).toBe("first line\nx");
  for (let index = 2; index <= 6; index++) {
    await send(page, `ordinary request ${index}`);
    await expect(page.getByTestId("conversation-turn").last()).toContainText(
      `Synthetic ordinary reply ${index}`,
    );
  }
  await composer.fill("Keep this unsent draft");
  const viewport = page.locator(".conversation-viewport");
  await viewport.hover();
  await page.mouse.wheel(0, -6000);
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollTop))
    .toBe(0);
  await expect(page.getByTestId("user-message").first()).toBeInViewport();
  await expect(composer).toBeInViewport();
  await page.getByRole("button", { name: "Scroll to latest message" }).click();
  await expect(page.getByTestId("assistant-message").last()).toBeInViewport();
  await expect(composer).toBeInViewport();
  expect(
    await page.evaluate(() => document.body.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("keeps pending-change controls and composer usable on short mobile screens with long invalid wording", async ({
  page,
}, testInfo) => {
  await fixtureHealth(page);
  const pending = {
    kind: "legacy" as const,
    id: "synthetic-long-invalid-change",
    originalRequest: "under 200CHF",
    message: `under 200CHF ${"with an unresolved qualifier ".repeat(55)}`,
    reason: "currency" as const,
    explanation:
      "This synthetic invalid currency change is unresolved. Choose SGD or USD, or explicitly discard this change.",
  };
  const preferences = {
    ...syntheticComparison().intent,
    pendingChange: pending,
  };
  let calls = 0;
  await page.route("**/api/turn", (route) => {
    calls++;
    const incoming = route.request().postDataJSON() as TurnRequest;
    return route.fulfill({
      json:
        incoming.edit?.kind === "discard-pending"
          ? {
              responseVersion: 5,
              kind: "message",
              preferences: { ...preferences, pendingChange: null },
              notes: [],
              message: "Synthetic pending change explicitly discarded.",
            }
          : {
              responseVersion: 5,
              kind: "clarification",
              preferences,
              notes: [],
              reason: "currency",
              message: pending.explanation,
            },
    });
  });
  await page.setViewportSize({ width: 390, height: 600 });
  await page.goto("/");
  await send(page, pending.message);
  await expect(
    page.getByRole("button", { name: "Resolve change", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Discard pending change", exact: true }),
  ).toBeInViewport();
  await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
  await page
    .getByRole("button", { name: "Review pending change", exact: true })
    .click();
  await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
  expect(
    await page.evaluate(() => document.body.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: testInfo.outputPath("long-pending-mobile.png"),
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Resolve change", exact: true })
    .click();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue(
    pending.message,
  );
  expect(calls).toBe(1);
  await page
    .getByRole("button", { name: "Discard pending change", exact: true })
    .click();
  await expect(page.locator(".pending-change")).toHaveCount(0);
  expect(calls).toBe(2);
});

test("does not accept a stale prepared intent or start research after its generation was cancelled", async ({
  page,
}) => {
  await fixtureHealth(page);
  const requests: Record<string, unknown>[] = [];
  let release: (() => void) | undefined;
  await page.route("**/api/turn", async (route) => {
    requests.push(route.request().postDataJSON());
    if (requests.length === 1) {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      await route
        .fulfill({
          json: {
            kind: "prepared",
            preferences: syntheticComparison().intent,
            notes: [],
          },
        })
        .catch(() => undefined);
    } else
      await route.fulfill({
        json: {
          responseVersion: 5,
          kind: "message",
          message: "Synthetic ordinary acknowledgment.",
          preferences: defaultIntent(),
          notes: [],
        },
      });
  });
  await page.goto("/");
  await send(page, "Exclude Stale Brand");
  await expect.poll(() => requests.length).toBe(1);
  await page.getByLabel("Message", { exact: true }).fill("Thanks");
  release!();
  await expect(
    page.getByText("Response stopped.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText("Synthetic ordinary acknowledgment."),
  ).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1].phase).toBe("prepare");
  expect(requests[1].preferences).toEqual(defaultIntent());
  await expect(page.getByRole("article")).toHaveCount(0);
});
