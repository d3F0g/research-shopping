export const phoneBudgetRequest =
  "I want to buy a phone for my nephew that costs around 500-600";

export const conversationalRanges = [
  phoneBudgetRequest,
  "A pottery wheel with a price of 500-600",
  "A neutron interferometer priced around 500 to 600",
  "I can spend 500–600 on an unfamiliar instrument",
  "An unfamiliar instrument with a budget around 500-600",
  "A phone for my nephew with a budget about 500-600",
  "A phone costs500-600 with model700-800",
  "Phone model700-800 costs500-600",
  "A phone costs500-600 with256-512GB of storage",
];

export const ambiguousConversationalRanges = [
  "A phone costing 500-600 or 700-800",
  "A phone costing 700-800 or 500-600",
  "500-600 or a phone costing 700-800",
  "A device costs 500-600 with a choice of 700-800",
];

export const negatedConversationalRanges = [
  "I do not want a phone that costs around 500-600",
  "I refuse to spend 500-600 on the phone",
  "The price must not be around 500-600",
  "A phone priced around 500-600 is not acceptable",
  "I don’t authorize spending 500-600",
  "I refuse a budget around 500-600",
];
