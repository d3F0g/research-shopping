import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const manifest = JSON.parse(
  await readFile(
    new URL(
      "../src/client/components/registry-provenance.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
for (const [path, expected] of Object.entries(manifest.unmodifiedFiles)) {
  const bytes = await readFile(new URL(`../${path}`, import.meta.url));
  if (createHash("sha256").update(bytes).digest("hex") !== expected)
    throw new Error(`Generated registry component changed: ${path}`);
}
process.stdout.write(
  `${Object.keys(manifest.unmodifiedFiles).length} official component files match the recorded CLI output.\n`,
);
