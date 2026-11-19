import capture from "./research-corpus/page-evidence/normalized-historical-application-response.json" with { type: "json" };

export const historicalSources = capture.research.sources;
export const historicalPreferences = capture.preferences;
export const testAuthoredExtractions = [
  {
    name: "JBL Tour One M3", url: historicalSources[0].url,
    identityQuote: "# JBL Tour One M3",
    quotedFacts: [], priceQuote: null,
  },
  {
    name: "Sennheiser MOMENTUM 4 Wireless Over-Ear Headphones - Teal (800073)", url: historicalSources[1].url,
    identityQuote: "# Sennheiser MOMENTUM 4 Wireless Over-Ear Headphones - Teal (800073)",
    quotedFacts: ["Boasting a high-fidelity 42 mm transducer system and support for aptX Adaptive, these headphones deliver rich, detailed sound with excellent dynamics."],
    priceQuote: "S$ 349 was S$ 499 SGD You Save S$ 150",
  },
];
export const historicalReplay = {
  requestId: "normalized-historical-replay-with-test-authored-extraction",
  costDollars: { total: 0.007 }, results: historicalSources,
  output: { content: { observations: testAuthoredExtractions } },
};

export const syntheticRawStructure = {
  title: "Aster Wave 2 - Teal (800073) | Synthetic raw-structure fixture",
  url: "https://reviews.example.com/aster-wave-2-teal",
  highlights: ["# Aster Wave 2 - Teal (800073)\nWireless over-ear headphones\n## Specifications\nDriver size: 42 mm.\nBattery life: Up to 60 hours on a full charge.\nWireless: Yes\nPrice: SGD 349"],
};
export const syntheticExtraction = {
  name: "Aster Wave 2 - Teal (800073)", url: syntheticRawStructure.url,
  identityQuote: "# Aster Wave 2 - Teal (800073)",
  quotedFacts: ["Driver size: 42 mm.", "Battery life: Up to 60 hours on a full charge."],
  priceQuote: "Price: SGD 349",
};
