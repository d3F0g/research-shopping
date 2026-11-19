import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
  { name: "short-mobile", width: 390, height: 568 },
]) {
  test(`${viewport.name} chat currency, evidence, history, theme and composer`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.route("**/model-*.png", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="100"><rect x="55" y="10" width="70" height="80" rx="8" fill="#777"/><text x="90" y="55" text-anchor="middle" fill="white">Fixture</text></svg>',
      }),
    );
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass("dark");
    await expect(
      page.getByRole("heading", { name: "What are you looking for?" }),
    ).toBeVisible();
    const composer = page.getByRole("textbox", {
      name: "Message",
      exact: true,
    });
    await expect(composer).toBeVisible();
    await mkdir("artifacts/fieldnote-v4/e2e", { recursive: true });
    await page.screenshot({
      path: `artifacts/fieldnote-v4/e2e/${viewport.name}-empty.png`,
    });
    await composer.fill("I want to buy a powerbank around $30-40.");
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "SGD", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "SGD", exact: true }).click();
    await expect(
      page.getByText("Fixture data. Automated test substitute.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Fixture Powerbank Model A", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("SGD 30–40", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Fixture Powerbank Model A", { exact: true }),
    ).toBeInViewport();
    await expect(
      page.getByText(/^Fixture Powerbank Model A is a source-supported option/),
    ).toBeInViewport();
    const intersections = await page.evaluate(() => {
      const scroll = document.querySelector<HTMLElement>(
        '[data-slot="message-scroller-button"][data-active="true"]',
      );
      if (!scroll) return [];
      const box = scroll.getBoundingClientRect();
      return [
        ...document.querySelectorAll<HTMLElement>(
          "a, button, input, textarea, select",
        ),
      ]
        .filter((el) => {
          if (
            el === scroll ||
            !el.checkVisibility() ||
            getComputedStyle(el).pointerEvents === "none"
          )
            return false;
          const target = el.getBoundingClientRect();
          return (
            Math.min(box.right, target.right) >
              Math.max(box.left, target.left) &&
            Math.min(box.bottom, target.bottom) > Math.max(box.top, target.top)
          );
        })
        .map((el) => el.textContent);
    });
    expect(intersections).toEqual([]);
    await page.screenshot({
      path: `artifacts/fieldnote-v4/e2e/${viewport.name}-research.png`,
    });
    await page
      .getByRole("button", {
        name: "Evidence and tradeoffs for Fixture Powerbank Model A",
        exact: true,
      })
      .click();
    await expect(page.getByText(/^Product identity/).first()).toBeVisible();
    await expect(page.locator("blockquote").first()).toContainText(
      "Fixture data:",
    );
    await page.screenshot({
      path: `artifacts/fieldnote-v4/e2e/${viewport.name}-evidence.png`,
    });
    const before = (await page.request
      .get("/api/test-stats")
      .then((r) => r.json())) as { calls: number };
    await composer.fill("Compare the first two.");
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(
      page.getByText(/Fixture Powerbank Model A: Battery life/),
    ).toBeVisible();
    const after = (await page.request
      .get("/api/test-stats")
      .then((r) => r.json())) as { calls: number };
    expect(after.calls).toBe(before.calls);
    const box = await composer.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThan(viewport.height);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await page.reload();
    await expect(page.locator("html")).toHaveClass("light");
    await expect(
      page.getByText(/Fixture Powerbank Model A: Battery life/),
    ).toBeVisible();
    await page.getByRole("button", { name: "New chat", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "What are you looking for?" }),
    ).toBeVisible();
    await composer.fill("hello");
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(
      page.getByText("Hi. What are you looking to buy?", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/fieldnote-v4/e2e/${viewport.name}-light-ordinary.png`,
    });
  });
}

test("edits the actual open objective, requirements and both budget bounds", async ({
  page,
}) => {
  await page.goto("/");
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  await composer.fill("A powerbank under SGD40");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText("Fixture data. Automated test substitute.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Current request and preferences",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Shopping objective", { exact: true })
    .fill("An archival book cradle");
  await page.getByLabel("Minimum", { exact: true }).fill("32");
  await page.getByLabel("Maximum", { exact: true }).fill("39");
  await page
    .getByRole("button", { name: "Add requirement", exact: true })
    .click();
  await page
    .getByLabel("Requirement 1", { exact: true })
    .fill("Must fold flat without tools");
  await page
    .getByRole("button", { name: "Apply and research", exact: true })
    .click();
  await expect(page.getByText("SGD 32–39", { exact: true })).toBeVisible();
  const response = await page.request.get("/api/session");
  const current = await response.json();
  expect(current.state.intent.originalText).toBe("An archival book cradle");
  expect(current.state.intent.budget).toEqual({
    minimum: 32,
    maximum: 39,
    currency: "SGD",
  });
  expect(current.state.intent.requirements).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        text: "Must fold flat without tools",
        strength: "hard",
      }),
    ]),
  );
  expect(
    current.state.messages.some(
      (m: { text: string }) => m.text === "A powerbank under SGD40",
    ),
  ).toBe(true);
});

test("keeps free replies during research and stops abandoned transport before new results publish", async ({
  page,
}) => {
  await page.goto("/");
  const calls = async () =>
    (
      (await page.request.get("/api/test-stats").then((r) => r.json())) as {
        calls: number;
      }
    ).calls;
  const baseline = await calls();
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  const send = async (text: string) => {
    await composer.fill(text);
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
  };
  await send("I want a slow fixture powerbank under SGD40");
  await expect(page.getByRole("status")).toContainText(
    "Requesting source-backed research",
  );
  await send("Keep it short.");
  await expect(
    page.getByText("I'll keep replies short.", { exact: true }),
  ).toBeVisible();
  await expect.poll(calls).toBe(baseline + 1);
  await expect(page.getByRole("status")).toHaveCount(0);
  await send("Research again");
  await expect(page.getByRole("status")).toContainText(
    "Requesting source-backed research",
  );
  await expect.poll(calls).toBe(baseline + 2);
  await page
    .getByRole("button", { name: "Stop research", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveCount(0);
  await send("Research again");
  await expect(page.getByRole("status")).toContainText(
    "Requesting source-backed research",
  );
  await expect.poll(calls).toBe(baseline + 3);
  await send("Only Anker");
  await expect.poll(calls).toBe(baseline + 4);
  await expect(page.getByRole("status")).toHaveCount(0);
  const current = await page.request.get("/api/session").then((r) => r.json());
  const retained = current.state.messages.filter(
    (m: { research?: unknown }) => m.research,
  );
  expect(retained).toHaveLength(2);
  expect(
    retained[1].research.intent.requirements.some(
      (r: { text: string }) => r.text === "Only Anker",
    ),
  ).toBe(true);
  expect(current.state.intent.budget).toMatchObject({
    maximum: 40,
    currency: "SGD",
  });
  expect(
    current.state.messages.some(
      (m: { text: string }) => m.text === "Keep it short.",
    ),
  ).toBe(true);
});

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`${viewport.name} New chat retains typing during its response and waits to submit`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const composer = page.getByRole("textbox", { name: "Message", exact: true });
    const send = page.getByRole("button", { name: "Send message", exact: true });
    const newChat = page.getByRole("button", { name: "New chat", exact: true });
    await composer.fill("A fixture powerbank around $30-40");
    await send.click();
    await expect(page.getByRole("button", { name: "SGD", exact: true })).toBeVisible();
    const calls = async () => (await page.request.get("/api/test-stats").then((r) => r.json())).calls as number;
    const baseline = await calls();
    let release!: () => void;
    let entered!: () => void;
    const held = new Promise<void>((resolve) => { entered = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/api/new-chat", async (route) => {
      entered();
      await gate;
      await route.continue();
    });
    const submissions: unknown[] = [];
    page.on("request", (request) => {
      if (request.url().endsWith("/api/turn")) submissions.push(request.postDataJSON());
    });
    await composer.fill("SGD");
    await newChat.click();
    await held;
    try {
      await expect(composer).toHaveValue("");
      await expect(composer).toBeEditable();
      await composer.fill("SGD");
      await expect(send).toBeDisabled();
      await expect(newChat).toBeDisabled();
      await composer.press("Enter");
      await expect(page.getByRole("button", { name: "SGD", exact: true })).toBeDisabled();
      await expect(composer).toHaveValue("SGD");
      expect(submissions).toEqual([]);
      expect(await calls()).toBe(baseline);
      await mkdir("artifacts/fieldnote-v4/e2e", { recursive: true });
      await page.screenshot({ path: `artifacts/fieldnote-v4/e2e/${viewport.name}-new-chat-pending.png` });
      const response = page.waitForResponse((result) => result.url().endsWith("/api/new-chat"));
      release();
      await response;
      await expect(page.getByRole("heading", { name: "What are you looking for?" })).toBeVisible();
      await expect(composer).toHaveValue("SGD");
      await expect(send).toBeEnabled();
      expect(submissions).toEqual([]);
      expect(await calls()).toBe(baseline);
      await page.screenshot({ path: `artifacts/fieldnote-v4/e2e/${viewport.name}-new-chat-draft-retained.png` });
      await composer.fill("hello");
      await send.click();
      await expect(page.getByText("Hi. What are you looking to buy?", { exact: true })).toBeVisible();
      expect(submissions).toHaveLength(1);
      expect(await calls()).toBe(baseline);
      const current = await page.request.get("/api/session").then((r) => r.json());
      expect(current.state.intent.budget).toBeNull();
      expect(current.state.intent.requirements).toEqual([]);
      expect(current.state.messages.some((message: { text: string }) => message.text.includes("powerbank"))).toBe(false);
    } finally {
      release();
    }
  });
}

test("a failed New chat keeps the new draft and history without retrying", async ({ page }) => {
  await page.goto("/");
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  const send = page.getByRole("button", { name: "Send message", exact: true });
  await composer.fill("hello");
  await send.click();
  await expect(page.getByText("Hi. What are you looking to buy?", { exact: true })).toBeVisible();
  let release!: () => void;
  let entered!: () => void;
  let attempts = 0;
  const held = new Promise<void>((resolve) => { entered = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/new-chat", async (route) => {
    attempts++;
    entered();
    await gate;
    await route.fulfill({ status: 503, json: { error: "Fixture reset unavailable" } });
  });
  await page.getByRole("button", { name: "New chat", exact: true }).click();
  await held;
  try {
    await composer.fill("Fixture draft after failed reset");
    await expect(send).toBeDisabled();
    release();
    await expect(page.getByText("The server could not start a new chat. Your history stays visible.", { exact: true })).toBeVisible();
    await expect(composer).toHaveValue("Fixture draft after failed reset");
    await expect(page.getByText("Hi. What are you looking to buy?", { exact: true })).toBeVisible();
    await expect(send).toBeEnabled();
    expect(attempts).toBe(1);
  } finally {
    release();
  }
});

for (const outcome of ["success", "failure"]) {
  test(`a late Stop ${outcome} preserves the new chat and draft`, async ({ page }) => {
    await page.goto("/");
    const composer = page.getByRole("textbox", { name: "Message", exact: true });
    const send = page.getByRole("button", { name: "Send message", exact: true });
    const calls = async () => (await page.request.get("/api/test-stats").then((response) => response.json())).calls as number;
    const baseline = await calls();
    const original = "I want a slow fixture powerbank under SGD40";
    await composer.fill(original);
    await send.click();
    await expect.poll(calls).toBe(baseline + 1);
    let release!: () => void;
    let entered!: () => void;
    const held = new Promise<void>((resolve) => { entered = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/api/cancel", async (route) => {
      const response = await route.fetch();
      entered();
      await gate;
      await route.fulfill(outcome === "success" ? { response } : { status: 503, json: { error: "Fixture cancellation unavailable" } });
    });
    await page.getByRole("button", { name: "Stop research", exact: true }).click();
    await held;
    try {
      await page.getByRole("button", { name: "New chat", exact: true }).click();
      await expect(page.getByRole("heading", { name: "What are you looking for?" })).toBeVisible();
      await composer.fill("hello");
      await send.click();
      await expect(page.getByText("Hi. What are you looking to buy?", { exact: true })).toBeVisible();
      await composer.fill("Fixture draft after Stop and New chat");
      const pendingResponse = page.waitForResponse((response) => response.url().endsWith("/api/cancel"));
      release();
      await (await pendingResponse).finished();
      const current = await page.request.get("/api/session").then((response) => response.json());
      expect(current.state.intent.budget).toBeNull();
      expect(current.state.messages.some((message: { text: string }) => message.text === "hello")).toBe(true);
      await expect(page.getByText(original, { exact: true })).toHaveCount(0);
      await expect(page.getByText("Hi. What are you looking to buy?", { exact: true })).toBeVisible();
      await expect(page.getByText("The server could not confirm cancellation. No automatic retry was sent.", { exact: true })).toHaveCount(0);
      await expect(composer).toHaveValue("Fixture draft after Stop and New chat");
      await expect(send).toBeEnabled();
      expect(await calls()).toBe(baseline + 1);
      await composer.fill("thanks");
      await send.click();
      await expect(page.getByText("thanks", { exact: true })).toBeVisible();
      expect(await calls()).toBe(baseline + 1);
    } finally {
      release();
    }
  });
}

test("a current Stop failure preserves accepted context and allows the next message", async ({ page }) => {
  await page.goto("/");
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  const send = page.getByRole("button", { name: "Send message", exact: true });
  const calls = async () => (await page.request.get("/api/test-stats").then((response) => response.json())).calls as number;
  const baseline = await calls();
  await composer.fill("I want a slow fixture powerbank under SGD40");
  await send.click();
  await expect.poll(calls).toBe(baseline + 1);
  let attempts = 0;
  await page.route("**/api/cancel", async (route) => {
    attempts++;
    await route.fetch();
    await route.fulfill({ status: 503, json: { error: "Fixture cancellation unavailable" } });
  });
  await composer.fill("Fixture draft during Stop");
  await page.getByRole("button", { name: "Stop research", exact: true }).click();
  await expect(page.getByText("The server could not confirm cancellation. No automatic retry was sent.", { exact: true })).toBeVisible();
  await expect(composer).toHaveValue("Fixture draft during Stop");
  await expect(page.getByText("SGD 0–40", { exact: true })).toBeVisible();
  expect(attempts).toBe(1);
  await composer.fill("hello");
  await send.click();
  await expect(page.getByText("Hi. What are you looking to buy?", { exact: true })).toBeVisible();
  await expect(page.getByText("The server could not confirm cancellation. No automatic retry was sent.", { exact: true })).toHaveCount(0);
  expect(await calls()).toBe(baseline + 1);
  const current = await page.request.get("/api/session").then((response) => response.json());
  expect(current.state.intent.budget).toMatchObject({ maximum: 40, currency: "SGD" });
});

for (const endpoint of ["account", "session"]) {
  test(`a current ${endpoint} reload failure retains the draft and supports explicit recovery`, async ({ page }) => {
    await page.route(`**/api/${endpoint}`, (route) => route.fulfill({ status: 503, json: { error: "Fixture bootstrap unavailable" } }));
    await page.goto("/");
    await expect(page.getByText("The server is unavailable. Your draft is retained. Reload your account when it returns.", { exact: true })).toBeVisible();
    const baseline = (await page.request.get("/api/test-stats").then((response) => response.json())).calls;
    const composer = page.getByRole("textbox", { name: "Message", exact: true });
    const send = page.getByRole("button", { name: "Send message", exact: true });
    await composer.fill("Fixture draft during unavailable account");
    await expect(send).toBeDisabled();
    await page.unroute(`**/api/${endpoint}`);
    await page.getByRole("button", { name: "Account", exact: true }).click();
    await page.getByRole("button", { name: "Reload account", exact: true }).click();
    await expect(page.getByText("Accounts are not configured.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(composer).toHaveValue("Fixture draft during unavailable account");
    await expect(send).toBeEnabled();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await composer.fill("hello");
    await send.click();
    await expect(page.getByText("Hi. What are you looking to buy?", { exact: true })).toBeVisible();
    expect((await page.request.get("/api/test-stats").then((response) => response.json())).calls).toBe(baseline);
  });
}

for (const endpoint of ["account", "session"]) {
  for (const outcome of ["success", "failure"]) {
    test(`a stale ${endpoint} bootstrap ${outcome} preserves a newer ordinary guest reply`, async ({ page }) => {
      let release!: () => void;
      let entered!: () => void;
      let requests = 0;
      const held = new Promise<void>((resolve) => { entered = resolve; });
      const gate = new Promise<void>((resolve) => { release = resolve; });
      await page.route(`**/api/${endpoint}`, async (route) => {
        if (++requests !== 1) return route.continue();
        const response = await route.fetch();
        entered();
        await gate;
        await route.fulfill(outcome === "success" ? { response } : { status: 503, json: { error: "Fixture stale bootstrap failure" } });
      });
      await page.goto("/");
      await held;
      try {
        await expect(page.getByRole("button", { name: "New chat", exact: true })).toBeEnabled();
        const baseline = (await page.request.get("/api/test-stats").then((response) => response.json())).calls;
        const composer = page.getByRole("textbox", { name: "Message", exact: true });
        const send = page.getByRole("button", { name: "Send message", exact: true });
        await composer.fill("hello");
        await send.click();
        await expect(page.getByText("Hi. What are you looking to buy?", { exact: true })).toBeVisible();
        await composer.fill("Fixture draft after guest reply");
        const response = page.waitForResponse((response) => response.url().endsWith(`/api/${endpoint}`));
        release();
        await (await response).finished();
        const current = await page.request.get("/api/session").then((response) => response.json());
        expect(current.state.messages.some((message: { text: string }) => message.text === "hello")).toBe(true);
        await expect(page.getByText("Hi. What are you looking to buy?", { exact: true })).toBeVisible();
        await expect(page.getByRole("alert")).toHaveCount(0);
        await expect(composer).toHaveValue("Fixture draft after guest reply");
        await expect(send).toBeEnabled();
        await composer.fill("thanks");
        await send.click();
        await expect(page.getByText("thanks", { exact: true })).toBeVisible();
        expect((await page.request.get("/api/test-stats").then((response) => response.json())).calls).toBe(baseline);
      } finally {
        release();
      }
    });
  }
}
