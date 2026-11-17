import { describe, expect, it } from "vitest";
import { isSafeWebResearchUrl, WebResearchSourceSchema } from "../../src/domain/web-research";

const source = (url: string) => WebResearchSourceSchema.safeParse({
  title: "Product review",
  url,
  highlights: [],
});

describe("web research source links", () => {
  it.each([
    "https://reviews.example.com/product",
    "https://www.sony.com.sg/electronics/headphones",
  ])("accepts public HTTPS source URLs such as %s", (url) => {
    expect(source(url).success).toBe(true);
  });

  it.each([
    "http://reviews.example.com/product",
    "javascript:alert(1)",
    "https://user:password@reviews.example.com/product",
    "https://localhost/product",
    "https://private.localhost/product",
    "https://printer.local/product",
    "https://service.internal/product",
    "https://127.0.0.1/product",
    "https://192.168.1.10/product",
    "https://2130706433/product",
    "https://[::1]/product",
    "https://reviews.example.com:8443/product",
  ])("rejects unsafe or non-public source URL %s", (url) => {
    expect(isSafeWebResearchUrl(url)).toBe(false);
    expect(source(url).success).toBe(false);
  });
});
