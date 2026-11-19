import { readFile } from "node:fs/promises";
import { z } from "zod";
import { categories, type Scenario } from "./contracts";
import { milestones } from "./dataset/milestones";
import { hash } from "./hash";
const RawScenario = z.object({ id: z.string().regex(/^FN-[A-Z]{2}-\d{3}$/), dimension: z.string(), turns: z.array(z.string().min(1)).min(2), hard: z.array(z.string()).min(1), expect: z.array(z.string()).min(1), critical: z.array(z.string()).min(1), provider: z.string() }).strict();
const aliases: Record<string, typeof categories[number]> = {
  "budget-currency-reasoning": "budget-currency", "multi-turn-preference-retention": "preference-retention", "user-corrections-dissatisfaction": "corrections-dissatisfaction", "research-tool-selection": "research-selection", "product-comparison-quality": "comparison-quality", "evidence-attribution-source-honesty": "evidence-honesty", "evidence-attribution-honesty": "evidence-honesty", "chat-presentation-interaction": "chat-interaction", "error-recovery-safety": "recovery-safety",
};
export async function loadDataset() {
  const source = await readFile(new URL("./dataset/scenarios.v1.jsonl", import.meta.url), "utf8");
  const raw = source.trim().split("\n").map((line) => RawScenario.parse(JSON.parse(line)));
  const ids = raw.map((row) => row.id);
  if (new Set(ids).size !== ids.length || ids.length < 50) throw new Error("Dataset needs at least 50 unique cases");
  const scenarios: Scenario[] = raw.map((row) => {
    const category = aliases[row.dimension] ?? row.dimension;
    if (!categories.includes(category as typeof categories[number])) throw new Error(`Unknown dimension ${row.dimension}`);
    if (!milestones[row.id]?.length) throw new Error(`Missing executable expectations for ${row.id}`);
    return { id: row.id, revision: 1, category: category as typeof categories[number], title: row.turns[0]!, actions: row.turns.map((text) => ({ kind: "message" as const, text })), provider: row.provider, expectedBehavior: [...row.hard.map((value) => `Hard requirement. ${value}`), ...row.expect, ...row.critical.map((value) => `Critical failure. ${value}`)], milestones: milestones[row.id]!, review: { status: "author-drafted", reference: "Independent original dataset author; executable translation awaiting independent final review" }, ...(row.id === "FN-CU-001" ? { issue: 44 } : {}) };
  });
  return { scenarios, hash: hash({ source, milestones }), originalSha256: hash(source) };
}
