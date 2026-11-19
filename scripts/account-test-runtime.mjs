import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";
import { fixtureDatabase, run } from "./test-postgres.mjs";

async function port() {
  const socket = net.createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const value = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return value;
}
export async function accountRuntime({ web = false } = {}) {
  const fixture = await fixtureDatabase();
  const directory = await mkdtemp(join(tmpdir(), "fieldnote-v2-lifecycle-"));
  const apiPort = await port(),
    webPort = web ? await port() : apiPort;
  const origin = `http://127.0.0.1:${webPort}`;
  const apiOrigin = `http://127.0.0.1:${apiPort}`;
  const ledger = join(directory, "usage.json");
  const env = {
    ...process.env,
    NODE_ENV: "test",
    EXA_RESEARCH_ENABLED: "false",
    EXA_API_KEY: "",
    EXA_RESEARCH_LEDGER_PATH: "",
    FIELDNOTE_TEST_DATABASE_URL: fixture.url,
    FIELDNOTE_DATABASE_URL: fixture.url,
    FIELDNOTE_TEST_LEDGER_PATH: ledger,
    API_PORT: String(apiPort),
    VITE_API_PORT: String(apiPort),
    WEB_PORT: String(webPort),
    FIELDNOTE_AUTH_ORIGIN: origin,
    FIELDNOTE_AUTH_SECRET: "fixture-account-lifecycle-secret-long-enough",
  };
  const processes = new Set();
  const diagnostics = [];
  let api;
  function launch(role, command, args) {
    const child = spawn(command, args, {
      env,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    processes.add(child);
    const diagnostic = { role, startedAt: Date.now(), stdout: "", stderr: "", truncated: false, exitCode: null, signal: null };
    diagnostics.push(diagnostic);
    if (diagnostics.length > 8) diagnostics.shift();
    let output = "";
    for (const stream of ["stdout", "stderr"]) child[stream].on("data", (value) => {
      const text = String(value);
      output = (output + text).slice(-16_384);
      diagnostic.truncated ||= diagnostic[stream].length + text.length > 8192;
      diagnostic[stream] = (diagnostic[stream] + text).slice(-8192);
    });
    child.on("exit", (code, signal) => { diagnostic.exitCode = code; diagnostic.signal = signal; });
    child.fixtureOutput = () => output;
    return child;
  }
  async function ready(url, child) {
    for (let i = 0; i < 150; i++) {
      if (child.exitCode !== null) throw new Error(child.fixtureOutput());
      try {
        if ((await fetch(url)).ok) return;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(
      `Owned test runtime did not become ready. ${child.fixtureOutput()}`,
    );
  }
  async function stop(child, signal = "SIGTERM") {
    if (child && child.exitCode === null && child.signalCode === null) {
      const done = once(child, "exit");
      process.kill(-child.pid, signal);
      await done;
    }
    if (child) processes.delete(child);
  }
  async function start() {
    api = launch("api", process.execPath, [
      "--import",
      "tsx",
      "tests/helpers/account-runtime.ts",
    ]);
    await ready(`${apiOrigin}/api/health`, api);
  }
  try {
    await run(
      process.execPath,
      ["--import", "tsx", "src/server/database-command.ts", "migrate"],
      env,
    );
    await start();
    if (web) {
      const vite = launch("vite", process.execPath, [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
      ]);
      await ready(origin, vite);
    }
  } catch (error) {
    for (const child of processes) await stop(child);
    await fixture.stop();
    await rm(directory, { recursive: true });
    throw error;
  }
  return {
    origin,
    apiOrigin,
    ledger,
    database: fixture.url,
    diagnostics: () => diagnostics.map((diagnostic) => ({ ...diagnostic })),
    async restart() {
      await stop(api);
      await start();
    },
    async restartDatabase() {
      await stop(api);
      await fixture.restart();
      await start();
    },
    async crash() {
      await stop(api, "SIGKILL");
    },
    start,
    async close() {
      for (const child of [...processes]) await stop(child);
      await fixture.stop();
      await rm(directory, { recursive: true });
    },
  };
}
