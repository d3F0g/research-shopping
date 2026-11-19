import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import type { Pool } from "pg";

const directory = new URL("../../migrations/", import.meta.url);
export async function migrationManifest() {
  const names = (await readdir(directory))
    .filter((name) => /^\d{3}-.+\.sql$/.test(name))
    .sort();
  return Promise.all(
    names.map(async (name) => {
      const sql = await readFile(new URL(name, directory), "utf8");
      return {
        name,
        sql,
        checksum: createHash("sha256").update(sql).digest("hex"),
      };
    }),
  );
}
export async function migrate(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(738192406)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS fieldnote_migration (name text PRIMARY KEY, checksum text NOT NULL)",
    );
    const manifest = await migrationManifest();
    const applied = await client.query<{ name: string; checksum: string }>(
      "SELECT name, checksum FROM fieldnote_migration ORDER BY name",
    );
    for (const [index, row] of applied.rows.entries()) {
      if (manifest[index]?.name !== row.name)
        throw new Error("Migration order mismatch");
      if (
        manifest.find((item) => item.name === row.name)?.checksum !==
        row.checksum
      )
        throw new Error("Migration checksum mismatch");
    }
    for (const item of manifest) {
      if (applied.rows.some((row) => row.name === item.name)) continue;
      await client.query("BEGIN");
      try {
        await client.query(item.sql);
        await client.query(
          "INSERT INTO fieldnote_migration (name, checksum) VALUES ($1, $2)",
          [item.name, item.checksum],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client
      .query("SELECT pg_advisory_unlock(738192406)")
      .catch(() => undefined);
    client.release();
  }
}
export async function assertDatabaseReady(pool: Pool) {
  const applied = await pool.query<{ name: string; checksum: string }>(
    "SELECT name, checksum FROM fieldnote_migration ORDER BY name",
  );
  const manifest = await migrationManifest();
  if (
    applied.rows.length !== manifest.length ||
    manifest.some(
      (item, i) =>
        item.name !== applied.rows[i].name ||
        item.checksum !== applied.rows[i].checksum,
    )
  )
    throw new Error("Apply the checked-in migrations before enabling accounts");
  await pool.query(
    'SELECT s.id, s."userId", s."expiresAt", w.revision, w.epoch, w.data FROM "session" s LEFT JOIN fieldnote_v2_workspace w ON w.user_id = s."userId" LIMIT 0',
  );
}
