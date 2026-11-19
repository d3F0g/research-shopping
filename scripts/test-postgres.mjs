import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";

export async function fixtureDatabase() {
  if (process.env.FIELDNOTE_TEST_DATABASE_URL)
    throw new Error("Unset FIELDNOTE_TEST_DATABASE_URL. Tests create an owned temporary cluster.");
  const executable = (name) =>
    process.platform === "darwin" ? `/opt/homebrew/bin/${name}` : name;
  const version = spawnSync(executable("postgres"), ["--version"], {
    encoding: "utf8",
  });
  if (!version.stdout.includes(" 17."))
    throw new Error(
      "PostgreSQL 17 is required for the owned temporary test cluster",
    );
  const listener = net.createServer();
  await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  const directory = await mkdtemp(join(tmpdir(), "fieldnote-pg-test-"));
  const run = (name, args) => {
    const result = spawnSync(executable(name), args, { encoding: "utf8" });
    if (result.status !== 0)
      throw new Error(`${name} failed for the temporary fixture cluster`);
  };
  const start = () =>
    run("pg_ctl", [
      "-D",
      join(directory, "data"),
      "-l",
      join(directory, "postgres.log"),
      "-o",
      `-h 127.0.0.1 -p ${port} -k ${directory}`,
      "-w",
      "start",
    ]);
  const stop = () =>
    run("pg_ctl", ["-D", join(directory, "data"), "-m", "fast", "-w", "stop"]);
  run("initdb", [
    "-D",
    join(directory, "data"),
    "-U",
    "fieldnote_fixture",
    "--auth=trust",
    "--no-locale",
    "-E",
    "UTF8",
  ]);
  start();
  run("createdb", [
    "-h",
    "127.0.0.1",
    "-p",
    String(port),
    "-U",
    "fieldnote_fixture",
    "fieldnote_fixture",
  ]);
  return {
    url: `postgresql://fieldnote_fixture@127.0.0.1:${port}/fieldnote_fixture`,
    restart: async () => {
      stop();
      start();
    },
    stop: async () => {
      stop();
      await rm(directory, { recursive: true });
    },
  };
}
export async function run(command, args, env) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      ...env,
      EXA_RESEARCH_ENABLED: "false",
      EXA_API_KEY: "",
      EXA_RESEARCH_LEDGER_PATH: "",
      FIELDNOTE_TEST_FIXTURES: "false",
      NODE_ENV: "test",
    },
  });
  const code = await new Promise((resolve) => child.once("exit", resolve));
  if (code !== 0) throw new Error(`${command} failed`);
}
if (process.argv[1]?.endsWith("test-postgres.mjs")) {
  const fixture = await fixtureDatabase();
  try {
    await run(
      process.execPath,
      [
        "node_modules/vitest/vitest.mjs",
        "run",
        "--config",
        "vitest.postgres.config.ts",
      ],
      { FIELDNOTE_TEST_DATABASE_URL: fixture.url },
    );
  } finally {
    await fixture.stop();
  }
}
