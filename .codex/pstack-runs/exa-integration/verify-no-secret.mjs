import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

try {
  const key = process.env.EXA_API_KEY?.trim();
  if (!key) throw new Error("Load the private development environment for this local leak check.");
  const needles = [...new Set([key, encodeURIComponent(key), Buffer.from(key).toString("base64"), JSON.stringify(key).slice(1, -1)])].map((value) => Buffer.from(value));
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  const git = (args, options = {}) => execFileSync("git", args, { cwd: root, maxBuffer: 256 * 1024 * 1024, ...options });
  const tracked = git(["ls-files", "-z"]).toString().split("\0").filter(Boolean);
  const trackedEnvironments = tracked.filter((name) => /(?:^|\/)\.env(?:\.|$)/.test(name) && !name.endsWith(".env.example"));
  const names = git(["rev-list", "--objects", "HEAD"]).toString().trim().split("\n").map((line) => line.split(" ")[0]);
  const objects = git(["cat-file", "--batch"], { input: `${names.join("\n")}\n` });
  const matches = [];
  let archives = 0;
  const hasKey = (data) => needles.some((needle) => data.includes(needle));
  const scan = (data, label) => {
    if (hasKey(data)) matches.push(label);
    if (data.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
      archives += 1;
      const directory = mkdtempSync(path.join(tmpdir(), "exa-archive-scan-"));
      try {
        const archivePath = path.join(directory, "archive.zip");
        writeFileSync(archivePath, data, { mode: 0o600 });
        const archive = execFileSync("python3", ["-c", "import base64,json,os,sys,urllib.parse,zipfile; key=os.environ['EXA_API_KEY'].strip(); variants=[key,urllib.parse.quote(key,safe=\"-_.!~*'()\"),base64.b64encode(key.encode()).decode(),json.dumps(key,ensure_ascii=False)[1:-1]]; needles=[x.encode() for x in variants]; z=zipfile.ZipFile(sys.argv[1]); entries=z.infolist(); assert sum(x.file_size for x in entries)<=67108864, 'Archive exceeds local scan limit'; matched=any(any(needle in content for needle in needles) for content in (z.read(entry) for entry in entries if not entry.is_dir())); print(json.dumps({'matched':matched}))", archivePath], { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024, timeout: 15_000 });
        const result = JSON.parse(archive.toString());
        if (typeof result.matched !== "boolean") throw new Error("Archive scan did not complete.");
        if (result.matched) matches.push(`${label} (unpacked)`);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  };
  let offset = 0;
  for (const id of names) {
    const end = objects.indexOf(10, offset);
    const [, type, sizeText] = objects.subarray(offset, end).toString().split(" ");
    const size = Number(sizeText);
    if (end < offset || !Number.isSafeInteger(size)) throw new Error("Could not inspect Git objects.");
    const data = objects.subarray(end + 1, end + 1 + size);
    scan(data, `git:${id}:${type}`);
    offset = end + size + 2;
  }
  const scanDirectory = (directory) => {
    if (!existsSync(directory)) return 0;
    let count = 0;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) count += scanDirectory(target);
      else if (entry.isFile()) {
        scan(readFileSync(target), path.relative(root, target));
        count += 1;
      }
    }
    return count;
  };
  const buildFiles = scanDirectory(path.join(root, "dist"));
  const livePath = process.argv[2];
  const liveFiles = livePath ? scanDirectory(path.resolve(livePath)) : 0;
  const passed = trackedEnvironments.length === 0 && matches.length === 0 && buildFiles > 0 && (!livePath || liveFiles > 0);
  process.stdout.write(`${JSON.stringify({ result: passed ? "passed" : "failed", gitObjects: names.length, archives, buildFiles, liveFiles, trackedEnvironments, secretMatches: matches })}\n`);
  process.exitCode = passed ? 0 : 1;

} catch {
  process.stderr.write("Local leak check could not complete. No environment or file contents are displayed.\n");
  process.exitCode = 1;
}
