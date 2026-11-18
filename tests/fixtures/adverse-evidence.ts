import type { Feature } from "../../src/domain/legacy-contracts";

export const adverseFixtureLabel = "Synthetic adverse-evidence fixture. Not live product evidence.";
export const adverseName = "Aster Wave 2";
export const adverseHeading = "# Aster Wave 2\nWireless over-ear headphones";
export const adverseClass = "Aster Wave 2 is a pair of wireless headphones.";
export const adverseFeatures = {
  "active-noise-cancelling": { category: "headphones", positive: "has active noise cancellation.", negative: "does not support active noise cancellation.", label: "ANC", pronoun: "These headphones lack ANC." },
  wireless: { category: "headphones", positive: "supports Bluetooth.", negative: "is not equipped with Bluetooth.", label: "Wireless", pronoun: "These headphones are not wireless." },
  multipoint: { category: "headphones", positive: "supports multipoint.", negative: "has no multipoint support.", label: "Multipoint", pronoun: "These headphones lack multipoint." },
  "long-battery-life": { category: "headphones", positive: "has long battery life.", negative: "does not have long battery life.", label: "Long battery life", pronoun: "These headphones lack long battery life." },
  lightweight: { category: "headphones", positive: "is lightweight.", negative: "is not lightweight.", label: "Lightweight", pronoun: "These headphones are not lightweight." },
  "oled-display": { category: "laptops", positive: "has an OLED display.", negative: "does not have an OLED display.", label: "OLED", pronoun: "These headphones lack an OLED display." },
  "high-memory": { category: "laptops", positive: "has 32 GB memory.", negative: "does not have 32 GB memory.", label: "32 GB", pronoun: "These headphones lack high memory." },
  "long-battery": { category: "laptops", positive: "has long battery life.", negative: "does not have long battery life.", label: "Long battery", pronoun: "These headphones lack long battery life." },
  portable: { category: "laptops", positive: "is portable.", negative: "is not portable.", label: "Portable", pronoun: "These headphones are not portable." },
} satisfies Record<Feature, { category: "headphones" | "laptops"; positive: string; negative: string; label: string; pronoun: string }>;

export const wirelessNegatives = [
  "is not wireless.", "isn't wireless.", "isn’t wireless.", "are not wireless.", "aren't wireless.",
  "does not support wireless connectivity.", "doesn't support Bluetooth.", "doesn’t support Bluetooth.",
  "do not have wireless.", "don't include Bluetooth.", "cannot offer Bluetooth.", "can't provide wireless.",
  "has no wireless support.", "is without Bluetooth.", "lacks wireless support.", "lack Bluetooth.",
  "is not equipped with Bluetooth.", "is no longer wireless.",
  "does not use any Bluetooth.", "does not include a wireless connection.",
  "is wired-only.", "is wired only.", "supports wired audio only.", "supports wired connections only.",
  "only supports wired audio.", "supports only wired connections.", "uses wired audio only.",
  "has only wired connections.", "can only use wired audio.", "can support only wired.",
  "provides wired-only connectivity.", "offers only wired connections.",
  "is a wired-only headset.", "is wired-only headphones.", "is a pair of wired-only headphones.",
  "is wired-only earbuds.", "is an over-ear wired-only headset.", "is the wired-only headset.",
  "is the pair of wired-only earbuds.", "are wired-only headphones.", "are a pair of wired-only headphones.",
  "is a wired only headset.", "is a wired-only over-ear headset.", "is a lightweight wired-only headset.",
  "is a wired-only lightweight headset.", "is a lightweight over-ear wired-only headset.",
  "is a pair of wired-only in-ear earbuds.", "is a pair of closed-back wired-only headphones.",
  "is a noise-cancelling wired-only headset.", "is a wired-only noise-canceling headset.",
  "is a wired-only gaming headset.", "is a wired-only stereo headset.", "is a wired-only portable headset.",
  "are a pair of open-back wired-only headphones.", "is an on-ear wired-only headset.",
];
export const adversePriceConditions = [
  "With trade-in of a qualifying device.", "Per month for 12 months.", "Members only.",
  "Deposit required.", "With qualifying subscription.", "Per week for 24 weeks.",
  "After cashback.", "For replacement pads.", "Terms to be determined.",
];

export const featurePropertyFixtures = {
  "active-noise-cancelling": { whole: "ANC", narrower: ["ANC microphone", "active noise cancellation during calls", "ANC adjustment"] },
  wireless: { whole: "Bluetooth", narrower: ["wireless charging", "Bluetooth LE Audio", "Bluetooth 5.4", "wireless microphone support"] },
  multipoint: { whole: "multipoint", narrower: ["multipoint device switching", "multipoint pairing to three devices", "multipoint in gaming mode"] },
  "long-battery-life": { whole: "long battery life", narrower: ["long battery life indicator", "long battery life during gaming", "long battery life mode"] },
  lightweight: { whole: "lightweight", narrower: ["lightweight charger", "lightweight support", "lightweight cable"] },
  "oled-display": { whole: "OLED", narrower: ["OLED touch display", "OLED secondary screen", "OLED panel at 120 Hz"] },
  "high-memory": { whole: "32 GB", narrower: ["32 GB graphics memory", "32 GB storage", "32 GB memory expansion"] },
  "long-battery": { whole: "long battery life", narrower: ["long battery indicator", "long battery life when gaming", "long battery charging mode"] },
  portable: { whole: "portability", narrower: ["portable charging", "portability accessories", "portability kit"] },
} satisfies Record<Feature, { whole: string; narrower: string[] }>;

export function adversePayload(path: "heading" | "direct", highlights: string[], changes: { facts?: string[]; price?: string | null; name?: string; title?: string } = {}) {
  const url = "https://reviews.example.com/adverse-fixture";
  return {
    requestId: "synthetic-adverse-evidence-fixture",
    costDollars: { total: 0.007 },
    results: [{ url, title: changes.title ?? (path === "heading" ? `${adverseName} | ${adverseFixtureLabel}` : adverseFixtureLabel), highlights }],
    output: { content: { observations: [{ name: changes.name ?? adverseName, url, identityQuote: path === "heading" ? `# ${adverseName}` : null, quotedFacts: changes.facts ?? (path === "direct" ? [adverseClass] : []), priceQuote: changes.price ?? null }] } },
  };
}
