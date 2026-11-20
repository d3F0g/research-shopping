import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:buffer";
import { writeFile } from "node:fs/promises";

const base = process.argv[2] ?? "9d2a3c5e336a6652ec6b02e0c3deff6617fb7d11";
const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const args = ["-c", "credential.interactive=false", "diff", base, "HEAD"];
const child = spawn("git", args, { stdio: ["ignore", "pipe", "inherit"] });
const hash = createHash("sha256");
let bytes = 0;
let characters = 0;
for await (const chunk of child.stdout) {
  bytes += chunk.length;
  characters += chunk.toString().length;
  hash.update(chunk);
}
const code = child.exitCode ?? await new Promise((resolve) => child.once("close", resolve));
if (code !== 0) throw new Error(`git diff exited ${code}`);
const result = {
  base,
  head,
  command: ["git", ...args],
  node: process.version,
  bytes,
  decodedChunkCharacters: characters,
  maxStringLength: constants.MAX_STRING_LENGTH,
  exceedsMaxStringLength: characters > constants.MAX_STRING_LENGTH,
  sha256: hash.digest("hex"),
  collection: "Each stdout chunk is counted and hashed independently. No complete diff string is allocated.",
  limit: "Measures the actual PR-base-to-HEAD patch, including preserved generated evidence. This does not execute Playwright's unsafe concatenation.",
};
await writeFile(new URL("./diff-size.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
