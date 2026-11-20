import { Pool } from "pg";
import { accountConfiguration } from "./accounts";
import { assertDatabaseReady, migrate } from "./account-migrations";
import { cleanExpiredWorkspaces } from "./workspace-store";

const configuration = accountConfiguration(process.env);
if (configuration.status !== "configured")
  throw new Error(
    "Configure local account persistence before running database commands",
  );
const pool = new Pool({
  connectionString: configuration.databaseUrl,
  connectionTimeoutMillis: 3000,
});
try {
  if (process.argv[2] === "migrate") {
    await migrate(pool);
    process.stdout.write("Database migrations applied.\n");
  } else if (process.argv[2] === "cleanup") {
    await assertDatabaseReady(pool);
    const count = await cleanExpiredWorkspaces(pool);
    process.stdout.write(`Cleared expired content in ${count} workspaces.\n`);
  } else throw new Error("Choose migrate or cleanup");
} catch {
  process.stderr.write(
    "Database command failed. Check local configuration and migration readiness.\n",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
