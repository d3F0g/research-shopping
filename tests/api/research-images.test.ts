import { describe, expect, it } from "vitest";
import { syntheticAnswer } from "../fixtures/dynamic-research";
import { research } from "../helpers/local-exa";

describe("returned citation image metadata", () => {
  it("retains a safe returned image URL beside its source", async () => {
    const payload = syntheticAnswer();
    const url = "https://example.com/product-picture.jpg";
    const result = await research({ ...payload, citations: payload.citations.map((source) => ({ ...source, image: url })) });
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.research.evidenceVersion).toBe(5);
      expect(result.research.sources[0]).toMatchObject({ url: payload.citations[0]!.url, imageUrl: url });
    }
  });
  it.each(["javascript:alert(1)", "data:image/png;base64,abc", "https://127.0.0.1/image", "https://user:pass@example.com/image"])("drops unsafe image metadata %s", async (image) => {
    const payload = syntheticAnswer();
    const result = await research({ ...payload, citations: payload.citations.map((source) => ({ ...source, image })) });
    expect(result.status).toBe("ready");
    if (result.status === "ready") expect(result.research.sources.every((source) => source.imageUrl === undefined)).toBe(true);
  });
  it("drops conflicting duplicate images without losing consistent text evidence", async () => {
    const payload = syntheticAnswer();
    const first = payload.citations[0]!;
    const result = await research({ ...payload, citations: [
      { ...first, image: "https://example.com/a.jpg" },
      { ...first, image: "https://example.com/b.jpg" },
    ] });
    expect(result.status).toBe("ready");
    if (result.status === "ready") { expect(result.research.sources).toHaveLength(1); expect(result.research.sources[0]!.imageUrl).toBeUndefined(); }
  });
  it("does not treat favicon metadata as product photography", async () => {
    const payload = syntheticAnswer();
    const result = await research({ ...payload, citations: payload.citations.map((source) => ({ ...source, favicon: "https://example.com/favicon.png" })) });
    expect(result.status).toBe("ready");
    if (result.status === "ready") expect(result.research.sources.every((source) => source.imageUrl === undefined)).toBe(true);
  });
});
