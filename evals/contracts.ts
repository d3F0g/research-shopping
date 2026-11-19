import { z } from "zod";

export const DATASET_VERSION = "1.0.0";
export const ASSERTION_VERSION = "1.0.0";
export const ADAPTER_VERSION = "normal-v4.1";
export const categories = ["conversational-understanding", "preference-extraction", "contextual-clarification", "budget-currency", "preference-retention", "corrections-dissatisfaction", "research-selection", "product-relevance", "comparison-quality", "evidence-honesty", "chat-interaction", "recovery-safety"] as const;
export type Category = typeof categories[number];
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Intent = {
  productDescription: string;
  criteria: { id: string; wording: string; strength: "hard" | "flexible" }[];
  budget: { amount: number; minimum?: number; currency: string } | null;
  budgetClarified: boolean;
  pendingChange: { reason: string; message: string; explanation: string } | null;
  region: string;
  responseLength: string;
  revision: number;
  version: number;
};
export type Action =
  | { kind: "message"; text: string }
  | { kind: "skip-budget" }
  | { kind: "reset" }
  | { kind: "repeat-research" }
  | { kind: "cancel"; text: string };
export type Requirement =
  | { kind: "description"; includes: string[] }
  | { kind: "budget"; maximum: number; minimum?: number; currency: string }
  | { kind: "budget-null" }
  | { kind: "preserve"; from: number; fields: ("budget" | "criteria" | "region" | "productDescription")[] }
  | { kind: "criterion"; includes: string; strength: "hard" | "flexible"; meaning?: "exclude" | "only" }
  | { kind: "response"; kinds: string[]; reasons?: string[] }
  | { kind: "calls"; minimum: number; maximum: number }
  | { kind: "clarifications"; maximum: number }
  | { kind: "response-length"; value: "concise" | "expanded" }
  | { kind: "region"; value: string }
  | { kind: "pending"; value: boolean }
  | { kind: "no-choice" }
  | { kind: "products"; minimum: number }
  | { kind: "cancelled" }
  | { kind: "unassessed"; capability: string; reason: string };
export type Milestone = { after: number; requirements: Requirement[] };
export type Scenario = {
  id: string;
  revision: number;
  category: Category;
  title: string;
  actions: Action[];
  provider: string;
  expectedBehavior: string[];
  milestones: Milestone[];
  review: { status: "author-drafted" | "independently-reviewed"; reference: string };
  issue?: number;
};
export type PublicScenario = Pick<Scenario, "id" | "actions" | "provider">;
export type Material = {
  id: string;
  kind: "synthetic" | "derived-historical-source" | "recorded-exa-response";
  label: string;
  capturedAt: string | null;
  provenance: string[];
  sha256: string;
  body: Json;
  status: number;
  delayMs?: number;
};
export type Event = {
  sequence: number;
  turn: number;
  kind: "app-request" | "app-response" | "provider-request" | "provider-response" | "admission" | "settlement" | "cancelled" | "provider-aborted" | "reset";
  elapsedMs: number;
  body: Json;
};
export type TurnObservation = {
  index: number;
  action: Action;
  initialPreferences: Intent;
  finalPreferences: Intent;
  response: Record<string, Json> | null;
  providerCalls: number;
  cancelled: boolean;
};
export type Observation = {
  scenarioId: string;
  initialPreferences: Intent;
  finalPreferences: Intent;
  material: Material;
  turns: TurnObservation[];
  events: Event[];
  network: { denied: string[]; allowedOriginCount: number; externalRequests: 0 };
  cleanup: boolean;
  applicationError: string | null;
};
export type Check = {
  id: string;
  turn: number | null;
  status: "pass" | "fail" | "blocked" | "unsupported";
  critical: boolean;
  expected: Json;
  observed: Json;
  evidence: number[];
};
export type CaseResult = {
  id: string;
  category: Category;
  scenarioHash: string;
  expectationHash: string;
  materialHash: string;
  execution: "executed" | "infrastructure-error";
  verdict: "pass" | "fail" | "blocked" | "unsupported";
  expectedBehavior: string[];
  observation: Observation | null;
  checks: Check[];
  semantic: { status: "not-run"; reason: string; scores: null };
  reproduction: string;
  error?: string;
};
export type Metric = { passed: number; assessed: number; unassessed: number; rate: number | null };
export type RunReport = {
  schemaVersion: 1;
  createdAt: string;
  runId: string;
  datasetVersion: string;
  datasetHash: string;
  assertionVersion: string;
  adapterVersion: string;
  implementationHashes: { grading: string; adapter: string; suite: string };
  application: { commit: string; tree: string; dirty: boolean; sourceHash: string };
  suite: { commit: string; dirty: boolean };
  configuration: { provider: string; model: null; exaCreditsConsumed: 0; composition: string };
  cases: CaseResult[];
  summary: {
    total: number; executed: number; passed: number; failed: number; blocked: number; unsupported: number; infrastructureErrors: number; criticalFailures: number;
    categories: Record<string, Metric>;
    metrics: Record<string, Metric>;
    acceptance: "pass" | "fail" | "inconclusive";
  };
  limitations: string[];
};
export const MetricScoreSchema = z.object({ score: z.number().int().min(0).max(4), rationale: z.string().min(1).max(2000), uncertain: z.boolean() }).strict();
export const JudgmentsSchema = z.object({
  schemaVersion: z.literal(1),
  judge: z.object({ identity: z.string().min(1), provider: z.string().min(1), independentOfImplementation: z.literal(true), calibrationStatus: z.literal("pending-human-review") }).strict(),
  judgments: z.array(z.object({ label: z.string().regex(/^[a-f0-9]{24}$/), packetHash: z.string().regex(/^[a-f0-9]{64}$/), scores: z.record(z.string(), MetricScoreSchema), overall: z.enum(["useful", "not-useful", "uncertain"]) }).strict()).min(1),
}).strict();
