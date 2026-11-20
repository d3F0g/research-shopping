import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { initialConversation } from "../../src/domain/conversation";
import { ResearchSnapshotSchema } from "../../src/domain/research";
import { boundWorkspace, emptyWorkspace, WORKSPACE_LIMIT, workspaceBytes } from "../../src/domain/workspace";
import { NativeAnswerSchema, projectExaAnswer } from "../../src/server/exa-research";
import type { z } from "zod";

type Packet = { answer: z.infer<typeof NativeAnswerSchema>; citations: { url: string; title: string; text: string }[] };
const rich = (): Packet => JSON.parse(readFileSync(new URL("../../artifacts/issue-64-price-v5/grouped-rich-fixture.json", import.meta.url), "utf8"));
const intent = { ...initialConversation().intent, productDescription: "Fixture tool", budget: { minimum: 400, maximum: 500, currency: "SGD" } };
function project(packet: Packet) {
  const result = projectExaAnswer(packet, intent);
  if (result.status !== "ready") throw new Error(`Expected complete fixture projection, received ${result.reason}`);
  return result.research;
}
describe("bounded native groups and a shared identified money inventory", () => {
  it.each(["object", "string"])("fits 181 real-shaped synthetic occurrences in an actual %s answer, snapshot and workspace", (mode) => {
    const packet = rich();
    expect(packet.answer.products.map((product) => product.price!.sourceReviews.reduce((sum, review) => sum + review.moneyMentions.length, 0))).toEqual([11, 11, 11]);
    expect(JSON.stringify(packet.answer).length).toBeLessThan(128000);
    const result = projectExaAnswer({ ...packet, answer: mode === "object" ? packet.answer : JSON.stringify(packet.answer) }, intent);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("Expected comparison");
    const snapshot = result.research;
    expect(snapshot.sources.map((source) => source.moneyOccurrences.length)).toEqual([6, 3, 2, 88, 39, 3, 34, 6]);
    expect(snapshot.products.map((product) => product.eligible)).toEqual([true, true, true]);
    expect(snapshot.choice?.productId).toBe("fixture-tool-0");
    const ids = snapshot.sources.flatMap((source) => source.moneyOccurrences.map((occurrence) => occurrence.id)).sort();
    for (const product of snapshot.products) expect(product.priceEvidence.reviews.flatMap((review) => review.moneyMentions.flatMap((group) => group.occurrenceIds)).sort()).toEqual(ids);
    expect(ResearchSnapshotSchema.safeParse(snapshot).success).toBe(true);
    const workspace = emptyWorkspace();
    workspace.state.messages.push({ id: "fixture-rich", role: "assistant", text: snapshot.summary, research: snapshot });
    expect(workspaceBytes(workspace)).toBeLessThan(WORKSPACE_LIMIT);
    expect(boundWorkspace(workspace)).toBe(true);
  });
  it.each(["missing", "overlap", "partial", "wrong-role", "wrong-scope", "selected-multiple", "outside-support"])("does not authorize %s occurrence coverage", (mode) => {
    const packet = rich(), price = packet.answer.products[0]!.price!, review = price.sourceReviews[0]!;
    if (mode === "missing") review.moneyMentions.pop();
    if (mode === "overlap") review.moneyMentions.push(structuredClone(review.moneyMentions[0]!));
    if (mode === "partial") review.moneyMentions[1]!.quote = review.moneyMentions[1]!.quote.split("\n")[0]!;
    if (mode === "wrong-role") { review.moneyMentions[0]!.role = "other-product"; review.moneyMentions[0]!.scope = "other-subjects"; }
    if (mode === "wrong-scope") review.moneyMentions[1]!.scope = "selected-variant";
    if (mode === "selected-multiple") review.moneyMentions[0]!.quote = packet.citations[0]!.text;
    if (mode === "outside-support") review.moneyMentions[0]!.assessment.support = [{ url: packet.citations[1]!.url, quote: packet.citations[1]!.text.split("\n")[0]! }];
    const snapshot = project(packet), product = snapshot.products.find((entry) => entry.id === "fixture-tool-0")!;
    expect(product.priceEvidence.state).toBe("observed");
    expect(product.eligible).toBe(false);
    expect(snapshot.choice).toBeNull();
    expect(snapshot.sources.flatMap((source) => source.moneyOccurrences)).toHaveLength(181);
  });
  it.each(["competing-price", "extra-shipping", "unrelated-membership"])("cannot exempt a known %s alarm with favorable grouping", (mode) => {
    const packet = rich(), price = packet.answer.products[0]!.price!;
    const sourceIndex = mode === "unrelated-membership" ? 7 : 0;
    const source = packet.citations[sourceIndex]!, review = price.sourceReviews[sourceIndex]!;
    const passage = mode === "competing-price" ? "Fixture tool S0R0 standard costs SGD 537 for one unit, tax included." : mode === "extra-shipping" ? "Shipping costs SGD 15." : "This amount is available only after joining the annual club.";
    source.text += `\n\n${passage}`;
    if (mode !== "unrelated-membership") review.moneyMentions.push({ quote: passage, role: "reference", scope: "reference-only", assessment: { ...review.assessment, support: [{ url: source.url, quote: passage }] } });
    const snapshot = project(packet), product = snapshot.products.find((entry) => entry.id === "fixture-tool-0")!;
    expect(product.priceEvidence.alarms.length).toBeGreaterThan(0);
    expect(product.eligible).toBe(false);
    expect(snapshot.choice).toBeNull();
    expect(snapshot.sources[sourceIndex]!.text).toContain(passage);
  });
  it.each(["removed-inventory", "amount", "currency", "currency-span", "stale-id", "removed-review", "cut", "choice"])("rejects forged stored %s", (mode) => {
    const snapshot = project(rich()), source = snapshot.sources[0]!, price = snapshot.products[0]!.priceEvidence;
    if (mode === "removed-inventory") source.moneyOccurrences.pop();
    if (mode === "amount") Object.assign(source.moneyOccurrences[0]!.value, { minorUnits: 1 });
    if (mode === "currency") Object.assign(source.moneyOccurrences[0]!.value, { currency: "USD" });
    if (mode === "currency-span") source.moneyOccurrences[0]!.currencySpan!.start++;
    if (mode === "stale-id") price.reviews[0]!.moneyMentions[0]!.occurrenceIds[0] = "stale";
    if (mode === "removed-review") price.reviews.pop();
    if (mode === "cut") source.originalLength++;
    if (mode === "choice") snapshot.choice!.rationale = "Fixture invented explanation.";
    expect(ResearchSnapshotSchema.safeParse(snapshot).success).toBe(false);
  });
  it("recomputes stored alarms even if every optimistic applicability field is forged", () => {
    const packet = rich();
    packet.citations[0]!.text += "\n\nMembership required.";
    const snapshot = project(packet), product = snapshot.products.find((entry) => entry.id === "fixture-tool-0")!;
    const valid = project(rich()).products.find((entry) => entry.id === "fixture-tool-0")!;
    product.priceEvidence = valid.priceEvidence;
    product.eligible = true;
    product.blockers = [];
    snapshot.choice = { productId: product.id, rationale: product.requestMatch.rationale };
    expect(ResearchSnapshotSchema.safeParse(snapshot).success).toBe(false);
  });
  it.each(["object", "string"])("enforces 128000 actual serialized answer characters for %s values", (mode) => {
    const packet = rich();
    for (const product of packet.answer.products) for (const review of product.price!.sourceReviews) for (const group of review.moneyMentions) group.quote = "Fixture text ".repeat(307);
    expect(NativeAnswerSchema.safeParse(packet.answer).success).toBe(true);
    expect(JSON.stringify(packet.answer).length).toBeGreaterThan(128000);
    expect(projectExaAnswer({ ...packet, answer: mode === "object" ? packet.answer : JSON.stringify(packet.answer) }, intent)).toMatchObject({ status: "unavailable", reason: "invalid-response" });
  });
  it.each(["ASCII", "multibyte"])("keeps complete maximum sources and rejects an oversized %s workspace without trimming evidence", (mode) => {
    const packet = rich();
    for (const source of packet.citations) source.text = source.text.padEnd(24000, mode === "ASCII" ? "x" : "測");
    const snapshot = project(packet);
    const workspace = emptyWorkspace();
    workspace.state.messages.push({ id: "fixture-max", role: "assistant", text: snapshot.summary, research: snapshot });
    expect(snapshot.sources.every((source) => source.text.length === 24000 && !source.textTruncated)).toBe(true);
    expect(workspaceBytes(workspace)).toBeGreaterThan(WORKSPACE_LIMIT);
    const original = JSON.stringify(workspace);
    expect(boundWorkspace(workspace)).toBe(false);
    expect(JSON.stringify(workspace)).toBe(original);
  });
  it.each(["groups", "conditions"])("rejects an aggregate native %s overflow", (mode) => {
    const packet = rich(), price = packet.answer.products[0]!.price!;
    if (mode === "groups") for (let index = 0; index < 14; index++) price.sourceReviews[0]!.moneyMentions.push(structuredClone(price.sourceReviews[0]!.moneyMentions[0]!));
    else for (let index = 0; index < 9; index++) price.sourceReviews[index % 2]!.conditions.push({ quote: "tax included", text: "tax included", interpretation: "included-in-amount", rationale: "Fixture complete tax term." });
    expect(projectExaAnswer(packet, intent)).toMatchObject({ status: "unavailable", reason: "invalid-response" });
  });
});
