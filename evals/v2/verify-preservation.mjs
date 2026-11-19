import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../preservation-v2.json", import.meta.url), "utf8"));
assert.equal(manifest.sourceCommit, "f865939c669153943e77af3870e54c10daad6750");
assert.equal(manifest.assetCount, 390);
assert.equal(manifest.assets.length, 390);
const adapted = new Set([".github/workflows/product-evals.yml"]);
let verified = 0;
for (const asset of manifest.assets) {
  if (adapted.has(asset.path)) continue;
  const tracked = execFileSync("git", ["ls-files", "--error-unmatch", asset.path], { encoding: "utf8" }).trim();
  assert.equal(tracked, asset.path);
  assert.equal(execFileSync("git", ["hash-object", asset.path], { encoding: "utf8" }).trim(), asset.blob, asset.path);
  assert.equal(execFileSync("git", ["rev-parse", `HEAD:${asset.path}`], { encoding: "utf8" }).trim(), asset.blob, `${asset.path} committed blob`);
  verified++;
}
console.log(JSON.stringify({ sourceCommit: manifest.sourceCommit, unchangedCommittedAssets: verified, adaptedPaths: [...adapted] }));
