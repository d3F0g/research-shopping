import { readFile, writeFile, mkdir } from "node:fs/promises";
import { parseArgs } from "node:util";
import { join, resolve } from "node:path";
import { exportPackets, importJudgments, type Anchor, type Manifest, type Packet } from "./packets";
import { rubric } from "../../semantic/rubric";
import type { RunReport } from "../contracts";

const { positionals, values } = parseArgs({ allowPositionals: true, options: { report: { type: "string" }, out: { type: "string", default: "artifacts/product-evals/judge" }, limit: { type: "string", default: "6" }, packets: { type: "string" }, manifest: { type: "string" }, judgments: { type: "string" } } });
const directory = resolve(values.out!);
await mkdir(directory, { recursive: true });
if (positionals[0] === "export") {
  if (!values.report) throw new Error("Export requires --report");
  const report = JSON.parse(await readFile(values.report, "utf8")) as RunReport;
  const limit = Number(values.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error("Use a packet limit between 1 and 1000");
  const anchors = JSON.parse(await readFile(new URL("../../semantic/calibration.v1.json", import.meta.url), "utf8")) as Anchor[];
  const result = exportPackets(report, limit, anchors);
  await writeFile(join(directory, "packets.json"), JSON.stringify({ rubric, packets: result.packets }, null, 2));
  await writeFile(join(directory, "private-manifest.json"), JSON.stringify(result.manifest, null, 2));
  console.log(JSON.stringify({ status: "exported", packets: result.packets.length, blindInput: join(directory, "packets.json"), privateMapping: join(directory, "private-manifest.json"), humanCalibration: "pending", paidCalls: 0 }));
} else if (positionals[0] === "import") {
  if (!values.packets || !values.manifest || !values.judgments) throw new Error("Import requires --packets, --manifest and --judgments");
  const packetFile = JSON.parse(await readFile(values.packets, "utf8")) as { packets: Packet[] };
  const manifest = JSON.parse(await readFile(values.manifest, "utf8")) as Manifest;
  const raw = JSON.parse(await readFile(values.judgments, "utf8"));
  const result = importJudgments(raw, packetFile.packets, manifest);
  await writeFile(join(directory, "semantic-report.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ status: result.status, judgments: result.judgments.length, disagreements: result.calibrationDisagreements.length, humanCalibration: result.humanCalibration, artifact: join(directory, "semantic-report.json") }));
} else throw new Error("Use eval:judge export or eval:judge import");
