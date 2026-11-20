import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const directory = "artifacts/issue-65-bootstrap-transport";
const hello = ["hello", "Hi. What are you looking to buy?"];
const complete = [...hello, "thanks", "You're welcome. Tell me what you would like to change."];
type Event = { id: number; event: string; path: string; cookie?: string; aborted?: boolean; cancelled?: boolean };
type Status = { events: Event[]; gate: { entered: boolean; released: boolean } | null };
async function control(page: Page, input?: Record<string, unknown>): Promise<Status> {
  const response = input
    ? await page.request.post("/api/test-session-control", { data: input })
    : await page.request.get("/api/test-session-control");
  expect(response.ok()).toBe(true);
  return response.json();
}
async function snapshot(page: Page) {
  return page.evaluate(async () => (await fetch("/api/session?session-proof=readback")).json());
}
const texts = (value: { state: { messages: { text: string }[] } }) => value.state.messages.map((message) => message.text);
async function cookie(page: Page) {
  const value = (await page.context().cookies()).find((entry) => entry.name === "fieldnote-session")?.value;
  return value ? createHash("sha256").update(value).digest("hex").slice(0, 12) : null;
}
async function fixtureState(page: Page) {
  return JSON.parse(await page.getByTestId("state").innerText());
}

test.beforeEach(async ({ page }) => { await control(page, { action: "reset" }); });
test.afterEach(async ({ page }, info) => {
  await control(page, { action: "release" });
  await mkdir(directory, { recursive: true });
  await writeFile(`${directory}/${info.title.replaceAll(/[^a-z0-9]+/gi, "-")}.json`, JSON.stringify({ result: info.status, browser: page.context().browser()?.version(), nativeTransport: true, status: await control(page), cookie: await cookie(page) }, null, 2));
});

for (const phase of ["headers", "body"] as const) {
  test(`native ${phase} cancellation preserves cookie ownership and complete history`, async ({ page }) => {
    await control(page, { action: "arm", phase });
    await page.goto("/tests/helpers/session-lifecycle.html");
    await expect.poll(async () => (await control(page)).gate?.entered).toBe(true);
    const held = (await control(page)).events.find((event) => event.event === "held")!;
    if (phase === "body") await expect.poll(() => cookie(page)).not.toBeNull();
    const installed = await cookie(page);
    if (phase === "headers") expect(installed).toBeNull();
    await page.getByRole("button", { name: "Fixture reload", exact: true }).click();
    await expect.poll(async () => (await control(page)).events.some((event) => event.id === held.id && event.event === "aborted")).toBe(true);
    await expect(page.getByRole("button", { name: "Fixture send", exact: true })).toBeEnabled();
    const owner = await cookie(page);
    expect(owner).not.toBeNull();
    if (phase === "body") expect(owner).toBe(installed);
    const input = page.getByLabel("Fixture draft", { exact: true });
    await input.fill("hello");
    await page.getByRole("button", { name: "Fixture send", exact: true }).click();
    await expect.poll(async () => texts(await fixtureState(page))).toEqual(hello);
    await input.fill("Fixture draft after hello");
    expect(texts(await snapshot(page))).toEqual(hello);
    await control(page, { action: "release" });
    await expect.poll(async () => (await control(page)).events.some((event) => event.id === held.id && event.event === "released")).toBe(true);
    expect(await cookie(page)).toBe(owner);
    expect(texts(await snapshot(page))).toEqual(hello);
    expect(texts(await fixtureState(page))).toEqual(hello);
    await expect(input).toHaveValue("Fixture draft after hello");
    expect((await fixtureState(page)).error).toBe("");
    await input.fill("thanks");
    await page.getByRole("button", { name: "Fixture send", exact: true }).click();
    await expect.poll(async () => texts(await fixtureState(page))).toEqual(complete);
    const authoritative = await snapshot(page);
    expect(texts(authoritative)).toEqual(complete);
    await page.reload();
    await expect.poll(async () => (await fixtureState(page)).state.messages).toEqual(authoritative.state.messages);
    expect(await cookie(page)).toBe(owner);
    const events = (await control(page)).events;
    const replacement = events.find((event) => event.event === "request" && event.path === "/api/session" && event.id > held.id)!;
    expect(replacement.cookie).toBe(phase === "body" ? installed : null);
    expect(events.filter((event) => event.event === "created" && event.cookie).length).toBe(phase === "body" ? 1 : 2);
  });
}

test("native StrictMode bootstrap retains both guest turns and isolates another browser", async ({ page, browser }) => {
  await control(page, { action: "arm", phase: "headers" });
  await page.goto("/");
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  const send = page.getByRole("button", { name: "Send message", exact: true });
  await expect.poll(async () => (await control(page)).gate?.entered).toBe(true);
  await composer.fill("hello");
  await expect(send).toBeDisabled();
  await control(page, { action: "release" });
  await expect(send).toBeEnabled();
  await send.click();
  await expect(page.getByText(hello[1]!, { exact: true })).toBeVisible();
  await composer.fill("Fixture draft after hello");
  const owner = await cookie(page);
  const first = await snapshot(page);
  expect(texts(first)).toEqual(hello);
  expect((await control(page)).events.filter((event) => event.event === "created" && event.cookie)).toHaveLength(1);
  await expect(composer).toHaveValue("Fixture draft after hello");
  await composer.fill("thanks");
  await send.click();
  await expect(page.getByText(complete[3]!, { exact: true })).toBeVisible();
  const final = await snapshot(page);
  expect(texts(final)).toEqual(complete);
  await page.reload();
  await expect(page.getByText(complete[3]!, { exact: true })).toBeVisible();
  expect((await snapshot(page)).state.messages).toEqual(final.state.messages);
  expect(await cookie(page)).toBe(owner);
  await page.screenshot({ path: `${directory}/native-history-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${directory}/native-history-mobile.png` });
  const isolated = await browser.newContext();
  try {
    const other = await isolated.newPage();
    await other.goto("/");
    await expect(other.getByRole("button", { name: "New chat", exact: true })).toBeEnabled();
    expect(texts(await snapshot(other))).toEqual([]);
    expect(await cookie(other)).not.toBe(owner);
  } finally { await isolated.close(); }
});
