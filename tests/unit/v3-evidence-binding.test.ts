import { describe, expect, it } from "vitest";
import { bindReportedQuote, uniqueLiteralSpan, validEvidenceSupport } from "../../src/domain/evidence-binding-v3";

const source = (text: string) => ({ id: "fixture", text, textTruncated: false });
describe("literal whitespace provenance", () => {
  it.each([" ", "\n\n", "\r\n\r\n", "\t", "\u00a0", " \t\r\n\u00a0"])("preserves literal UTF-16 offsets for separator %j", (separator) => {
    const raw = source(`Fixture data. 🧪\n\nFixture 🕶️ Silver${separator}SGD 868\n\nEnd.`);
    const report = "Fixture 🕶️ Silver SGD 868";
    const bound = bindReportedQuote(raw, report)!;
    expect(bound.literal.text).toBe(`Fixture 🕶️ Silver${separator}SGD 868`);
    expect(raw.text.slice(bound.literal.start, bound.literal.end)).toBe(bound.literal.text);
    expect(bound.literal.start).toBe(raw.text.indexOf("Fixture 🕶️"));
    expect(bound.origin).toMatchObject({ reportedQuote: report });
    expect(validEvidenceSupport(raw, bound)).toBe(true);
  });
  it.each([["SG D", "SGD"], ["a bc", "ab c"], ["a\u200bb", "ab"], ["e\u0301", "é"], ["A-B", "A—B"], ["A X B", "A B"], ["a b a b a", "a b a"]])("rejects changed content or ambiguous spans %j %j", (text, report) => {
    expect(uniqueLiteralSpan(text, report)).toBeNull();
  });
  it("rejects a duplicate literal under adverse context even when one spelling is exact", () => {
    expect(bindReportedQuote(source("Fixture A SGD 868\n\nFixture A\n\nSGD 868 for another variant"), "Fixture A SGD 868")).toBeNull();
  });
  it("rejects forged reporting, offsets, match kind, context and cut metadata", () => {
    const raw = source("Fixture data.\n\nFixture A\n\nSGD 868\n\nFooter");
    const bound = bindReportedQuote(raw, "Fixture A SGD 868")!;
    const mutations = [
      { ...bound, origin: { kind: "provider" as const, reportedQuote: "Fixture A SGD 999", match: "whitespace" as const } },
      { ...bound, origin: { kind: "provider" as const, reportedQuote: "Fixture A SGD 868", match: "literal" as const } },
      { ...bound, literal: { ...bound.literal, start: bound.literal.start + 1 } },
      { ...bound, context: { start: bound.literal.start, end: bound.literal.end - 1, text: raw.text.slice(bound.literal.start, bound.literal.end - 1) } },
    ];
    for (const mutation of mutations) expect(validEvidenceSupport(raw, mutation)).toBe(false);
    expect(bindReportedQuote({ ...raw, text: raw.text.slice(0, bound.literal.end), textTruncated: true }, "Fixture A SGD 868")).toBeNull();
  });
});
