export const scopedName = "Aster Wave 2";
export const scopedText = "# Aster Wave 2\nWireless over-ear headphones\n## Specifications\nDriver size: 42 mm.\nWireless: Yes\nPrice: SGD 349";
const source = { title: "Aster Wave 2 | Synthetic raw-structure fixture", url: "https://reviews.example.com/aster" };
const native = { name: scopedName, url: source.url, identityQuote: "# Aster Wave 2" as string | null, quotedFacts: ["Driver size: 42 mm."], priceQuote: "Price: SGD 349" as string | null };
export function scopedResponse(text = scopedText, observation: Partial<typeof native> = {}, title = source.title) {
  return {
    costDollars: { total: 0.007 },
    results: [{ ...source, title, highlights: [text] }],
    output: { content: { observations: [{ ...native, ...observation }] } },
  };
}
export const otherModelFacts = [
  "Battery life: 60 hours for Orbit Quiet.",
  "Supports Bluetooth on Orbit Quiet.",
];
