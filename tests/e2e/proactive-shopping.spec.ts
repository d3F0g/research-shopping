import { expect, test, type Page } from "@playwright/test";
import { syntheticAnswer, syntheticAssessment } from "../fixtures/dynamic-research";
import { actualComposition } from "./support/actual-composition";
import { fixtureIntentInterpreter } from "../helpers/intent";

const request = "I want to buy a powerbank that costs around $30-40";

async function send(page: Page, message: string) {
  await page.getByLabel("Message", { exact: true }).fill(message);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
}

test("shows actual preparation and search activity with an attributed source illustration on desktop and mobile", async ({ page }, testInfo) => {
  const preparationRequest = `${request}. Prefer portability.`;
  const native = powerbankAnswer();
  Object.assign(native.citations[0], { image: "https://images.example.com/synthetic-powerbank.svg" });
  const imageRequests: import("@playwright/test").Request[] = [];
  await page.route("https://images.example.com/synthetic-powerbank.svg", (route) => {
    imageRequests.push(route.request());
    return route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#d0d0d0"/><text x="7" y="42" font-size="13">FIXTURE</text></svg>' });
  });
  const transport = await actualComposition(page, testInfo, native);
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(transport.baseUrl);
    await expect(page.locator(".composer-note")).toContainText("one paid Exa call");
    await expect(page.locator(".composer-note")).not.toContainText("OpenAI");
    await expect(page.locator("html")).toHaveClass(/dark/);
    transport.deferInterpretation();
    await send(page, preparationRequest);
    await expect(page.locator(".pending-message")).toHaveText("Understanding your request");
    await page.screenshot({ path: testInfo.outputPath("desktop-understanding.png") });
    transport.resumeInterpretation();
    const first = page.getByTestId("conversation-turn").first();
    await expect(first.getByRole("button", { name: "SGD", exact: true })).toBeVisible();
    transport.deferNext();
    await first.getByRole("button", { name: "SGD", exact: true }).click();
    await expect.poll(() => transport.sdkRequests.length).toBe(1);
    await expect(page.locator(".pending-message")).toHaveText(`Searching sources for ${preparationRequest}`);
    await expect(first.getByRole("button", { name: "SGD", exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("desktop-searching.png") });
    await page.setViewportSize({ width: 390, height: 600 });
    await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath("mobile-searching.png") });
    transport.resumeResearch();
    const card = page.getByRole("article", { name: "Synthetic Pocket 10", exact: true });
    const image = card.getByRole("img", { name: "Source illustration from Synthetic powerbank fixture", exact: true });
    await image.scrollIntoViewIfNeeded();
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(image).toHaveAttribute("loading", "lazy");
    await expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
    await expect(card.getByRole("link", { name: /Source illustration/ })).toHaveAttribute("href", native.citations[0].url);
    await expect(card.locator("figcaption")).toContainText("reviews.example.com");
    await expect(card).toContainText("Representative only. Exact variant unverified.");
    expect(imageRequests).toHaveLength(1);
    expect(imageRequests[0].headers().referer).toBeUndefined();
    expect(transport.interpretationRequests).toHaveLength(1);
    expect(transport.requests[1]).toHaveProperty("questionId", "question-1");
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 390, height: 600 }]) {
      await page.setViewportSize(viewport);
      await card.scrollIntoViewIfNeeded();
      await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      await page.screenshot({ path: testInfo.outputPath(`comparison-${viewport.width}-${viewport.height}.png`) });
    }
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await page.screenshot({ path: testInfo.outputPath("mobile-light-comparison.png") });
  } finally {
    await transport.close();
  }
});

for (const kind of ["missing", "unsafe", "load-error", "unsupported-identity"] as const) {
  test(`keeps the source illustration fallback honest for ${kind} images`, async ({ page }, testInfo) => {
    const native = powerbankAnswer();
    if (kind !== "missing") Object.assign(native.citations[0], { image: kind === "unsafe" ? "http://127.0.0.1/private.png" : "https://images.example.com/unavailable.png" });
    if (kind === "unsupported-identity") native.answer.products[0].identity.status = "unknown";
    let imageRequests = 0;
    await page.route("https://images.example.com/**", (route) => {
      imageRequests++;
      return route.abort("failed");
    });
    const transport = await actualComposition(page, testInfo, native);
    try {
      await page.goto(transport.baseUrl);
      await send(page, "A powerbank under SGD40");
      const card = page.getByRole("article", { name: "Synthetic Pocket 10", exact: true });
      await expect(card.getByRole("img", { name: "Source illustration unavailable", exact: true })).toBeVisible();
      await expect(card.locator("img")).toHaveCount(0);
      await expect(card).toContainText("No source illustration available.");
      expect(imageRequests).toBe(kind === "load-error" ? 1 : 0);
      expect(transport.sdkRequests).toHaveLength(1);
    } finally {
      await transport.close();
    }
  });
}

test("retains the resolved budget through provider failure and retries research without reinterpreting", async ({ page }, testInfo) => {
  const transport = await actualComposition(page, testInfo, powerbankAnswer());
  try {
    await page.goto(transport.baseUrl);
    await send(page, request);
    await expect(page.getByTestId("conversation-turn").last()).toContainText("SGD or USD");
    transport.failNextResearch();
    await send(page, "SGD");
    const latest = page.getByTestId("conversation-turn").last();
    await expect(latest.getByRole("heading", { name: "Research unavailable", exact: true })).toBeVisible();
    await expect(latest).toContainText("SGD 30–40");
    await expect(latest.getByRole("article")).toHaveCount(0);
    await expect(page.locator(".currency-choices, .question-card")).toHaveCount(0);
    expect(transport.sdkRequests).toHaveLength(1);
    await latest.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(latest.getByRole("article", { name: "Synthetic Pocket 10", exact: true })).toBeVisible();
    expect(transport.interpretationRequests).toHaveLength(0);
    expect(transport.sdkRequests).toHaveLength(2);
    const research = transport.requests.filter((turn) => turn.phase === "research");
    expect(research[1].operationId).not.toBe(research[0].operationId);
    expect(research[1].preferences).toEqual(research[0].preferences);
  } finally {
    await transport.close();
  }
});

test("keeps actual search activity compact for a long accepted description", async ({ page }, testInfo) => {
  const transport = await actualComposition(page, testInfo, powerbankAnswer());
  try {
    await page.setViewportSize({ width: 390, height: 600 });
    await page.goto(transport.baseUrl);
    transport.deferNext();
    await send(page, `A powerbank ${"for travel and remote field work ".repeat(20)}under SGD40`);
    await expect.poll(() => transport.sdkRequests.length).toBe(1);
    await expect(page.locator(".pending-message")).toHaveText("Searching product sources");
    await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
    expect((await page.locator(".pending-message").boundingBox())!.height).toBeLessThan(60);
    await page.getByRole("button", { name: "Stop response", exact: true }).click();
    await expect.poll(() => transport.aborts).toBe(1);
  } finally {
    await transport.close();
  }
});

test("keeps accepted constraints after cancellation and a new product description until New chat", async ({ page }, testInfo) => {
  const transport = await actualComposition(page, testInfo, powerbankAnswer(), {
    async interpretIntent(request, signal) {
      if (request.message.startsWith("New request")) return {
        status: "ready",
        interpretation: { disposition: "research", actions: [{ kind: "start-request", source: { start: 0, end: request.message.length, text: request.message } }] },
      };
      return fixtureIntentInterpreter(request, signal);
    },
  });
  try {
    await page.goto(transport.baseUrl);
    transport.deferNext();
    await send(page, "A powerbank under SGD40");
    await expect.poll(() => transport.sdkRequests.length).toBe(1);
    await page.getByRole("button", { name: "Stop response", exact: true }).click();
    await expect.poll(() => transport.aborts).toBe(1);
    await send(page, "Only Anker");
    await expect(page.getByTestId("conversation-turn").last()).toHaveAttribute("data-active", "true");
    const updated = transport.requests.filter((turn) => turn.phase === "research").at(-1)!;
    expect(updated.preferences).toMatchObject({ budget: { amount: 40, currency: "SGD" }, criteria: [expect.objectContaining({ wording: "Only Anker", strength: "hard" })] });
    await send(page, "New request. A slide scanner");
    await expect(page.getByTestId("conversation-turn").last()).toHaveAttribute("data-active", "true");
    const fresh = transport.requests.filter((turn) => turn.phase === "research").at(-1)!;
    expect(fresh.preferences).toMatchObject({ budget: { amount: 40, currency: "SGD" }, criteria: [expect.objectContaining({ wording: "Only Anker", strength: "hard" })], productDescription: "New request. A slide scanner" });
    await expect(page.getByTestId("conversation-turn").last().getByRole("heading", { name: /Conditional choice/ })).toHaveCount(0);
    await expect(page.getByTestId("user-message")).toHaveText(["A powerbank under SGD40", "Only Anker", "New request. A slide scanner"]);
    await expect(page.getByTestId("conversation-turn").first()).toContainText("Response stopped.");
    await page.getByRole("button", { name: "New chat", exact: true }).click();
    await send(page, "A portable powerbank");
    await expect(page.getByTestId("conversation-turn").last()).toHaveAttribute("data-active", "true");
    expect(transport.requests.filter((turn) => turn.phase === "research").at(-1)!.preferences).toMatchObject({ budget: null, criteria: [] });
  } finally {
    await transport.close();
  }
});

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
    conditions: ["One unit", "Tax included"],
    conditionsResolved: true,
    assessment: assessment("Synthetic source states SGD35 for the single black unit."),
  };
  product.budget = assessment("Synthetic observed SGD35 is within SGD30 to SGD40.");
  native.answer.choice = { productId: product.id, reasons: [{ kind: "field", name: "budget" }] };
  return native;
}

for (const currency of ["SGD", "S$", "SGD$30"]) {
  test(`retains the original 30 to 40 range after ${currency} and automatically researches`, async ({ page }, testInfo) => {
    const transport = await actualComposition(page, testInfo, powerbankAnswer(), { interpretIntent: null });
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
      expect(transport.interpretationRequests).toHaveLength(0);
      expect(transport.requests.filter((turn) => turn.phase === "research")).toEqual([
        expect.objectContaining({ preferences: expect.objectContaining({ budget: { minimum: 30, amount: 40, currency: "SGD" }, pendingChange: null }) }),
      ]);
      await expect(page.getByTestId("user-message")).toHaveText([request, currency]);
      await expect(page.locator(".pending-change, .question-card")).toHaveCount(0);
      if (currency === "SGD") {
        for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 600 }]) {
          await page.setViewportSize(viewport);
          await latest.getByRole("article").scrollIntoViewIfNeeded();
          await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
          await page.screenshot({ path: testInfo.outputPath(`no-interpreter-${viewport.width}.png`) });
        }
      }
    } finally {
      await transport.close();
    }
  });
}
