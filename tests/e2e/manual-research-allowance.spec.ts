import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { expect, test, type Page } from "@playwright/test";
import { freePort, startManualServer } from "../helpers/manual-composition";
import { manualResearchFiles, sha256 } from "../helpers/manual-research";

async function send(page: Page) {
  await page
    .getByLabel("Message", { exact: true })
    .fill(
      "A quiet H13 air purifier under SGD300. Must have washable prefilter.",
    );
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByTestId("conversation-turn").last()).toHaveAttribute(
    "data-active",
    "true",
  );
}

test("activates the manual allowance without a paid call and revokes the next browser request", async ({
  page,
}, testInfo) => {
  const files = await manualResearchFiles();
  const webPort = await freePort();
  const server = await startManualServer(files, {
    grantPath: files.grantPath,
    webPort,
  });
  const baseUrl = `http://127.0.0.1:${webPort}`;
  const web = spawn(
    `${process.cwd()}/node_modules/.bin/vite`,
    ["--host", "127.0.0.1"],
    {
      cwd: process.cwd(),
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "development",
        EXA_RESEARCH_ENABLED: "false",
        API_PORT: String(server.port),
        VITE_API_PORT: String(server.port),
        WEB_PORT: String(webPort),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const webExited = once(web, "exit");
  let webLog = "";
  web.stdout.on("data", (chunk) => {
    webLog += String(chunk);
  });
  web.stderr.on("data", (chunk) => {
    webLog += String(chunk);
  });
  const responses: unknown[] = [];
  page.on("response", async (response) => {
    if (response.url().endsWith("/api/turn"))
      responses.push(await response.json());
  });
  try {
    await expect
      .poll(
        async () => {
          try {
            return (await fetch(`${baseUrl}/api/health`)).ok;
          } catch {
            return false;
          }
        },
        { timeout: 15_000 },
      )
      .toBe(true);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(baseUrl);
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.locator(".composer-note")).toContainText(
      "one paid Exa call",
    );
    await send(page);
    await expect
      .poll(() => responses)
      .toContainEqual(
        expect.objectContaining({
          kind: "research-unavailable",
          reason: "quota",
        }),
      );
    expect(server.requests).toHaveLength(0);
    await page.screenshot({
      path: testInfo.outputPath("manual-default-denied-desktop.png"),
      animations: "disabled",
    });
    const created = await promisify(execFile)(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/manual-research-allowance.ts",
        "create",
        "--ledger",
        files.ledgerPath,
        "--grant",
        files.grantPath,
        "--grant-id",
        files.approval.grantId,
        "--approval-reference",
        files.approval.approvalReference,
        "--reviewed-commit",
        files.approval.reviewedCommit,
        "--approved-at",
        files.approval.approvedAt,
        "--expected-ledger-sha256",
        files.approval.expectedLedgerSha256,
      ],
      { env: { PATH: process.env.PATH, NODE_ENV: "development" } },
    );
    expect(JSON.parse(created.stdout)).toMatchObject({
      eligible: true,
      remainingAttempts: 10,
      remainingReservedUsd: 0.5,
    });
    expect(sha256(await readFile(files.ledgerPath, "utf8"))).toBe(
      files.approval.expectedLedgerSha256,
    );
    expect(server.requests).toHaveLength(0);
    await send(page);
    const result = page.getByTestId("conversation-turn").nth(1);
    await expect(
      result.getByRole("heading", {
        name: "Conditional choice · Synthetic fixture Aster Pure 30",
      }),
    ).toBeVisible();
    expect(server.requests).toHaveLength(1);
    await page.screenshot({
      path: testInfo.outputPath("manual-admitted-desktop.png"),
      animations: "disabled",
    });
    await page.setViewportSize({ width: 390, height: 700 });
    await result.getByRole("article").first().scrollIntoViewIfNeeded();
    await expect(page.getByLabel("Message", { exact: true })).toBeInViewport();
    expect(
      await page.evaluate(() => document.body.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.screenshot({
      path: testInfo.outputPath("manual-admitted-mobile.png"),
      animations: "disabled",
    });
    await unlink(files.grantPath);
    await send(page);
    await expect
      .poll(
        () =>
          responses.filter(
            (response) => (response as { reason?: string }).reason === "quota",
          ).length,
      )
      .toBe(2);
    expect(server.requests).toHaveLength(1);
    await expect(result.getByRole("article").first()).toBeAttached();
    const ledger = JSON.parse(await readFile(files.ledgerPath, "utf8"));
    expect(ledger.stopped).toBe(true);
    expect(ledger.attempts).toHaveLength(9);
    expect(ledger.attempts.slice(0, 8)).toEqual(files.baseline.attempts);
    await writeFile(
      testInfo.outputPath("manual-allowance-proof.json"),
      JSON.stringify(
        {
          label:
            "Synthetic test data through actual browser, index.ts, Hono and SDK with a fake key and loopback-only transport. No paid Exa request.",
          activation: JSON.parse(created.stdout),
          requests: server.requests,
          responses,
          baselinePreserved: true,
          stopped: ledger.stopped,
          attempts: ledger.attempts.length,
        },
        null,
        2,
      ),
    );
  } finally {
    web.kill("SIGTERM");
    await webExited;
    await server.close();
    await writeFile(
      testInfo.outputPath("server.log"),
      `${server.log}\n${webLog}`,
    );
  }
});
