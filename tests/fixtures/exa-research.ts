export const productResearchResponse = {
  requestId: "local-exa-request",
  results: [
    {
      title: "Aster Wave 2 specifications",
      url: "https://reviews.example.com/aster-wave-2",
      highlights: [
        "Aster Wave 2 uses Bluetooth wireless audio and active noise cancelling. Aster Wave 2 is a pair of wireless headphones. Aster Wave 2 is listed at SGD 229.00 on this page.",
      ],
    },
    {
      title: "Orbit Quiet specifications",
      url: "https://reviews.example.com/orbit-quiet",
      highlights: [
        "Orbit Quiet supports wireless audio and multipoint. Orbit Quiet is a pair of wireless headphones. Orbit Quiet was listed at USD 179.00 when reviewed.",
      ],
    },
  ],
  output: {
    content: {
      observations: [
        {
          name: "Aster Wave 2",
          url: "https://reviews.example.com/aster-wave-2",
          identityQuote: null, quotedFacts: [
            "Aster Wave 2 uses Bluetooth wireless audio and active noise cancelling.",
            "Aster Wave 2 is a pair of wireless headphones.",
          ],
          priceQuote: "Aster Wave 2 is listed at SGD 229.00 on this page.",
        },
        {
          name: "Orbit Quiet",
          url: "https://reviews.example.com/orbit-quiet",
          identityQuote: null, quotedFacts: ["Orbit Quiet supports wireless audio and multipoint.", "Orbit Quiet is a pair of wireless headphones."],
          priceQuote: "Orbit Quiet was listed at USD 179.00 when reviewed.",
        },
      ],
    },
    grounding: [
      {
        field: "provider specific field syntax",
        confidence: "high",
        citations: [
          { title: "Aster", url: "https://reviews.example.com/aster-wave-2" },
        ],
      },
    ],
  },
  costDollars: { total: 0.007 },
};
