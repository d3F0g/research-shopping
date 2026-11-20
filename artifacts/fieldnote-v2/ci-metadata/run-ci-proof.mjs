import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../../..");
const apiPort = 3197;
const webPort = 5297;
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const base = "9d2a3c5e336a6652ec6b02e0c3deff6617fb7d11";
const env = Object.fromEntries(["PATH", "HOME", "TMPDIR"].filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]));
Object.assign(env, {
  CI: "true",
  GITHUB_ACTIONS: "true",
  GITHUB_EVENT_PATH: path.join(directory, "pull-request-event.json"),
  GITHUB_SERVER_URL: "https://github.com",
  GITHUB_REPOSITORY: "d3F0g/research-shopping",
  GITHUB_SHA: commit,
  GITHUB_RUN_ID: "0",
  PLAYWRIGHT_API_PORT: String(apiPort),
  PLAYWRIGHT_WEB_PORT: String(webPort),
  PLAYWRIGHT_JSON_OUTPUT_FILE: path.join(directory, "playwright-report.json"),
  EXA_RESEARCH_ENABLED: "false",
  NODE_ENV: "test",
  DEBUG: "pw:git,pw:webserver",
});
await writeFile(env.GITHUB_EVENT_PATH, JSON.stringify({ pull_request: { title: "Local PR CI metadata reproduction", number: 53, base: { sha: base } } }, null, 2) + "\n");
for (const name of [".env", ".env.local", ".env.development", ".env.development.local", ".env.test", ".env.test.local"]) {
  const present = await access(path.join(root, name)).then(() => true, () => false);
  assert.equal(present, false, `Private environment file present: ${name}`);
}
const freePort = (port) => new Promise((resolve, reject) => {
  const server = createServer();
  server.once("error", reject);
  server.listen(port, "127.0.0.1", () => server.close(resolve));
});
await freePort(apiPort);
await freePort(webPort);
const artifacts = [];
for (const viewport of ["desktop", "mobile", "short-mobile"]) {
  for (const state of ["empty", "research", "evidence", "light-ordinary"])
    artifacts.push(`artifacts/fieldnote-v2/${viewport}-${state}.png`);
  for (const state of ["battery-concise.png", "battery-details.png", "comparison-concise.png", "proof.json"])
    artifacts.push(`artifacts/fieldnote-v2/conversation-polish/${viewport}-${state}`);
}
const originals = new Map(await Promise.all(artifacts.map(async (name) => [name, await readFile(path.join(root, name))])));
const run = (args, output) => new Promise((resolve, reject) => {
  const log = createWriteStream(path.join(directory, output));
  const child = spawn("npm", args, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => { log.write(chunk); process.stdout.write(chunk); });
  child.once("error", reject);
  child.once("close", (code) => log.end(async () => {
    try {
      const text = await readFile(path.join(directory, output), "utf8");
      await writeFile(path.join(directory, output), text.split("\n").map((line) => line.trimEnd()).join("\n").trimEnd() + "\n");
      resolve(code);
    } catch (error) {
      reject(error);
    }
  }));
});
const typecheckExit = await run(["run", "typecheck"], "typecheck.txt");
assert.equal(typecheckExit, 0);
let browserExit;
try {
  browserExit = await run(["run", "test:e2e", "--", "--reporter=list,json", "--output=artifacts/fieldnote-v2/ci-metadata/test-results"], "browser-run.txt");
  for (const name of artifacts) {
    const destination = path.join(directory, "browser-artifacts", name.slice("artifacts/fieldnote-v2/".length));
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(root, name), destination);
  }
} finally {
  for (const [name, content] of originals) await writeFile(path.join(root, name), content);
}
await freePort(apiPort);
await freePort(webPort);
assert.equal(browserExit, 0);
const report = JSON.parse(await readFile(env.PLAYWRIGHT_JSON_OUTPUT_FILE, "utf8"));
assert.equal(report.stats.expected, 8);
assert.equal(report.stats.unexpected, 0);
assert.equal(report.stats.skipped, 0);
assert.equal(report.stats.flaky, 0);
assert.equal(report.config.metadata.gitCommit.hash, commit);
assert.equal(report.config.metadata.ci.prBaseHash, base);
assert.equal(Object.hasOwn(report.config.metadata, "gitDiff"), false);
const changed = execFileSync("git", ["diff", "--name-only", "--", ".", ":(exclude)artifacts/fieldnote-v2/ci-metadata/**"], { cwd: root, encoding: "utf8" }).trim();
assert.equal(changed, "");
const proof = {
  result: "passed",
  applicationCommit: commit,
  base,
  node: process.version,
  playwright: JSON.parse(await readFile(path.join(root, "node_modules/playwright/package.json"), "utf8")).version,
  commands: ["npm run typecheck", "npm run test:e2e -- --reporter=list,json --output=artifacts/fieldnote-v2/ci-metadata/test-results"],
  typecheckExit,
  browserExit,
  stats: report.stats,
  metadata: report.config.metadata,
  inlineGitDiffPresent: Object.hasOwn(report.config.metadata, "gitDiff"),
  sourceChangesAfterRun: changed,
  savedBrowserArtifacts: artifacts.length,
  historicalArtifactsRestored: true,
  ownedPortsFreeAfterRun: [apiPort, webPort],
  limits: ["Local PR-like CI environment, not hosted Linux CI. GITHUB_RUN_ID=0 is synthetic.", "Node v22.20.0 locally, original hosted failure used v22.23.4.", "Actual Chromium, Hono service and Exa SDK use only an explicitly labeled local HTTP substitute. No live provider, paid ledger, private environment or existing database.", "No test source or assertion changed. Source correctness, live product usefulness and independent visual acceptance are outside this metadata fix."],
};
await writeFile(path.join(directory, "proof.json"), JSON.stringify(proof, null, 2) + "\n");
console.log(JSON.stringify(proof, null, 2));
