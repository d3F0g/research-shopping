import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HistoricalApplicationTurnResponseSchema } from "../../src/domain/research-history";
import { HistoricalResults } from "../../src/client/HistoricalResults";
import { syntheticComparison } from "../e2e/support/dynamic-fixture";

const snapshotPath = new URL(
  "../fixtures/research-corpus/page-evidence/normalized-historical-application-response.json",
  import.meta.url,
);

describe("read-only historical response rendering", () => {
  it("renders the frozen captured history without migrating its preferences or enabling actions", () => {
    const raw: unknown = JSON.parse(readFileSync(snapshotPath, "utf8"));
    const before = JSON.stringify(raw);
    const outcome = HistoricalApplicationTurnResponseSchema.parse(raw);
    const html = renderToStaticMarkup(
      createElement(HistoricalResults, { outcome }),
    );
    expect(html).toContain("Historical research snapshot");
    expect(html).toContain("historical research sources");
    expect(html).toContain(
      "could not attribute product-specific details reliably",
    );
    expect(html).not.toContain("Select this product");
    expect(html).not.toContain("Edit preferences");
    expect(JSON.stringify(raw)).toBe(before);
  });

  it("renders current assessment snapshots through the independent current renderer", () => {
    const research = syntheticComparison();
    const outcome = HistoricalApplicationTurnResponseSchema.parse({
      responseVersion: 4,
      kind: "research",
      preferences: research.intent,
      answer: research.summary,
      research,
      notes: [],
    });
    const html = renderToStaticMarkup(
      createElement(HistoricalResults, { outcome }),
    );
    expect(html).toContain("Conditional choice");
    expect(html).toContain("Synthetic Aster Scan");
    expect(html).toContain("Stock and delivery unverified");
    expect(html).not.toContain("Edit preferences");
  });
});
