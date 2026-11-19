import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { crossContractScorecard, scorecardMarkdown } from "./scorecard";

const { values } = parseArgs({ options: { baseline: { type: "string" }, candidate: { type: "string" }, out: { type: "string", default: "artifacts/product-evals/v2-scorecard" } }, strict: true });
if (!values.baseline || !values.candidate) throw new Error("Specify --baseline and --candidate");
const scorecard = await crossContractScorecard(JSON.parse(await readFile(values.baseline, "utf8")), JSON.parse(await readFile(values.candidate, "utf8")));
const output = resolve(values.out!);
await mkdir(output, { recursive: true });
await writeFile(join(output, "scorecard.json"), JSON.stringify(scorecard, null, 2));
await writeFile(join(output, "scorecard.md"), scorecardMarkdown(scorecard));
console.log(JSON.stringify({ artifact: join(output, "scorecard.json"), unchangedInputs: scorecard.unchangedInputs, differentHistoricalMaterial: scorecard.differentHistoricalMaterial, acceptance: scorecard.acceptance }));
