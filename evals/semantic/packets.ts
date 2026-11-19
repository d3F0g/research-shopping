import { randomBytes } from "node:crypto";
import { z } from "zod";
import { hash } from "../hash";
import type { Json, RunReport } from "../contracts";
import { dimensions } from "./rubric";

export const ScoreSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("scored"), score: z.number().int().min(0).max(4), rationale: z.string().min(1).max(2000), uncertain: z.boolean() }).strict(),
  z.object({ status: z.literal("not-observable"), score: z.null(), rationale: z.string().min(1).max(2000), uncertain: z.literal(true) }).strict(),
]);
const scoresShape = Object.fromEntries(dimensions.map((dimension) => [dimension, ScoreSchema])) as Record<typeof dimensions[number], typeof ScoreSchema>;
export const ImportedJudgments = z.object({
  schemaVersion: z.literal(1),
  judge: z.object({ identity: z.string().min(1).max(200), provider: z.string().min(1).max(200), independentOfImplementation: z.literal(true), identityEvidence: z.string().min(1).max(1000), implementationAuthorIdentity: z.string().min(1).max(200), calibrationStatus: z.literal("pending-human-review") }).strict(),
  judgments: z.array(z.object({ label: z.string().regex(/^[a-f0-9]{24}$/), packetHash: z.string().regex(/^[a-f0-9]{64}$/), scores: z.object(scoresShape).strict(), criticalFailures: z.array(z.string().min(1).max(1000)).max(20), overall: z.enum(["useful", "not-useful", "uncertain"]) }).strict()).min(1),
}).strict();
export type Packet = { label: string; packetHash: string; conversation: Json; supportingSources: Json; materialLabel: string };
export type Manifest = { schemaVersion: 1; applicationCommit: string; reportRunId: string; entries: { label: string; packetHash: string; caseId: string; calibrationId: string | null; referenceScores: Record<string, number | null> | null; disputes: string | null }[] };
export type Anchor = { id: string; userTurns: string[]; assistantBeforeFinalTurn?: string; observedFinalResponse: string; observedEvents?: string[]; heldEvidence?: string[]; referenceScores: Record<string, number | null>; disagreementToRecord?: string };
function object(value: Json | undefined): Record<string, Json> { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
export function exportPackets(report: RunReport, limit: number, anchors: Anchor[] = []) {
  const packets: Packet[] = [];
  const manifest: Manifest = { schemaVersion: 1, applicationCommit: report.application.commit, reportRunId: report.runId, entries: [] };
  const add = (conversation: Json, supportingSources: Json, materialLabel: string, entry: Omit<Manifest["entries"][number], "label" | "packetHash">) => {
    const label = randomBytes(12).toString("hex");
    const payload = { label, conversation, supportingSources, materialLabel };
    const packetHash = hash(payload);
    packets.push({ ...payload, packetHash });
    manifest.entries.push({ label, packetHash, ...entry });
  };
  for (const row of report.cases.filter((item) => item.observation).slice(0, limit)) {
    const observation = row.observation!;
    const conversation: Json[] = [];
    const sources: Json[] = [];
    for (const turn of observation.turns) {
      conversation.push({ role: "user", text: turn.action.kind === "message" || turn.action.kind === "cancel" ? turn.action.text : turn.action.kind });
      const research = object(turn.response?.research);
      conversation.push({ role: "assistant", text: turn.response?.message ?? turn.response?.answer ?? "No completed assistant response was observed.", products: research.products ?? [], choice: research.choice ?? null, structuredPreferences: { productDescription: turn.finalPreferences.productDescription, budget: turn.finalPreferences.budget, criteria: turn.finalPreferences.criteria, responseLength: turn.finalPreferences.responseLength }, providerDispatchCount: turn.providerCalls });
      if (Array.isArray(research.sources)) sources.push(...research.sources);
    }
    add(conversation, sources, [observation.material.label, ...observation.material.provenance.filter((value) => value.startsWith("Per-turn suitability") || value.startsWith("Input suitability gap"))].join(" "), { caseId: row.id, calibrationId: null, referenceScores: null, disputes: null });
  }
  for (const anchor of anchors) add({ userTurns: anchor.userTurns, assistantBeforeFinalTurn: anchor.assistantBeforeFinalTurn ?? null, observedFinalResponse: anchor.observedFinalResponse, observedEvents: anchor.observedEvents ?? [] }, anchor.heldEvidence ?? [], "Evaluation-author example. Human review pending.", { caseId: anchor.id, calibrationId: anchor.id, referenceScores: anchor.referenceScores, disputes: anchor.disagreementToRecord ?? null });
  packets.sort((a, b) => a.label.localeCompare(b.label));
  return { packets, manifest };
}
export function importJudgments(raw: unknown, packets: Packet[], manifest: Manifest) {
  const judged = ImportedJudgments.parse(raw);
  if (judged.judge.identity === judged.judge.implementationAuthorIdentity) throw new Error("An implementation author cannot grade their own output");
  if (new Set(judged.judgments.map((item) => item.label)).size !== judged.judgments.length) throw new Error("Duplicate judge labels are forbidden");
  if (judged.judgments.length !== packets.length) throw new Error("Every exported packet needs an explicit verdict, including not-observable dimensions");
  for (const item of judged.judgments) {
    const packet = packets.find((value) => value.label === item.label);
    const entry = manifest.entries.find((value) => value.label === item.label);
    if (!packet || !entry || packet.packetHash !== item.packetHash || entry.packetHash !== item.packetHash) throw new Error("Unknown label or packet hash mismatch");
    const { packetHash: _hash, ...payload } = packet;
    if (hash(payload) !== item.packetHash) throw new Error("Packet payload was modified after export");
  }
  const disagreements = judged.judgments.flatMap((item) => {
    const entry = manifest.entries.find((value) => value.label === item.label)!;
    if (!entry.calibrationId || !entry.referenceScores) return [];
    return dimensions.filter((dimension) => item.scores[dimension].score !== entry.referenceScores![dimension]).map((dimension) => ({ calibrationId: entry.calibrationId, dimension, reference: entry.referenceScores![dimension], judged: item.scores[dimension].score, rationale: item.scores[dimension].rationale, dispute: entry.disputes }));
  });
  return { schemaVersion: 1, status: "reporting-only", humanCalibration: "pending", independence: "Identity evidence and declaration recorded; must be independently verified by the run coordinator", judge: judged.judge, judgments: judged.judgments.map((item) => ({ ...item, caseId: manifest.entries.find((entry) => entry.label === item.label)!.caseId })), calibrationDisagreements: disagreements, uncertainVerdicts: judged.judgments.filter((item) => item.overall === "uncertain" || dimensions.some((dimension) => item.scores[dimension].uncertain)).map((item) => item.label) };
}
