import type { CriterionChange, Milestone, Requirement } from "../contracts";
const at = (after: number, ...requirements: Requirement[]): Milestone => ({ after, requirements });
const description = (...includes: string[]): Requirement => ({ kind: "description", includes });
const budget = (maximum: number, currency = "SGD", minimum?: number): Requirement => ({ kind: "budget", maximum, currency, ...(minimum === undefined ? {} : { minimum }) });
const hard = (includes: string): Requirement => ({ kind: "criterion", includes, strength: "hard", ...(includes === "Sony" ? { meaning: "exclude" as const } : includes === "Anker" ? { meaning: "only" as const } : {}) });
const flexible = (includes: string): Requirement => ({ kind: "criterion", includes, strength: "flexible" });
const calls = (minimum: number, maximum = minimum): Requirement => ({ kind: "calls", minimum, maximum });
const preserve = (from: number, ...fields: ("budget" | "criteria" | "region" | "productDescription")[]): Requirement => ({ kind: "preserve", from, fields });
const response = (...kinds: string[]): Requirement => ({ kind: "response", kinds });
const noChoice: Requirement = { kind: "no-choice" };
const semantic = (reason: string): Requirement => ({ kind: "unassessed", capability: "semantic-evidence", reason });
const unsupported = (currency: string): Requirement => ({ kind: "unassessed", capability: `unsupported:currency:${currency}`, reason: `Current application currency contract has no ${currency} representation. The requirement is retained, never converted or scored as satisfied.` });
export const milestones: Record<string, Milestone[]> = {
  "FN-CU-001": [at(0, description("powerbank"), calls(0), response("clarification")), at(1, description("powerbank"), budget(40, "SGD", 30), { kind: "pending", value: false }, calls(1), response("research"), { kind: "clarifications", maximum: 1 })],
  "FN-CU-002": [at(0, description("laptop", "travel")), at(1, description("laptop", "travel"), hard("1.3"), noChoice, unsupported("EUR"))],
  "FN-CU-003": [at(1, description("receiver"), hard("Fixture Bell 7"), noChoice, unsupported("GBP"))],
  "FN-CU-004": [at(1, description("slide"), budget(250, "USD"), semantic("Task-level slide compatibility and camera exclusion require independent semantic review."))],
  "FN-CU-005": [at(0, budget(100), hard("clamp")), at(1, description("floor lamp"), budget(180), hard("freestanding"), semantic("Abandoned clamp removal and retained UI history require contextual and browser review."))],
  "FN-PE-001": [at(0, description("Headphones", "flights"), budget(500)), at(1, budget(300), description("Headphones", "flights")), at(2, budget(300), hard("Sony"), description("Headphones", "flights"))],
  "FN-PE-002": [at(0, description("power bank")), at(1, description("power bank"), hard("Anker")), at(2, description("power bank"), hard("Anker"), hard("30 W"), budget(90, "SGD", 50), semantic("Input versus output wattage entails semantic source review."))],
  "FN-PE-003": [at(1, budget(180, "USD"), hard("Braille"), hard("phone app"), flexible("portability"))],
  "FN-PE-004": [at(1, description("aquarium"), hard("reusable"), hard("cartridges"), flexible("Quiet"), unsupported("AUD"))],
  "FN-PE-005": [at(1, description("kettle"), hard("100 V"), unsupported("JPY"), semantic("The strict below boundary cannot be encoded by the current inclusive budget contract."))],
  "FN-CC-001": [at(0, calls(0)), at(1, description("torque screwdriver"), budget(90, "USD", 60), hard("2 to 8"), calls(1), { kind: "clarifications", maximum: 1 })],
  "FN-CC-002": [at(2, description("sewing"), calls(0), unsupported("GBP"), semantic("Ambiguous ordinal references require held result order and denim evidence."))],
  "FN-CC-003": [at(0, calls(0)), at(1, description("cane"), budget(25, "USD"), hard("8 mm"), semantic("Named cane attachment compatibility requires supporting source entailment."))],
  "FN-CC-004": [at(1, description("lamp"), hard("brightness"), { kind: "budget-null" }, calls(1), { kind: "pending", value: false })],
  "FN-CC-005": [at(0, budget(140, "USD", 80), hard("wireless")), at(1, preserve(0, "budget"), calls(0)), at(2, preserve(0, "budget"), calls(0))],
  "FN-BC-001": [at(0, budget(160, "SGD", 100)), at(1, description("dock"), budget(160, "USD", 100))],
  "FN-BC-002": [at(1, description("grinder"), calls(0), unsupported("EUR"))],
  "FN-BC-003": [at(1, description("fountain pen"), unsupported("JPY"), semantic("Around 4000 remains a target while the explicit 6000 cap stays hard."))],
  "FN-BC-004": [at(1, description("soldering iron"), unsupported("AUD"))],
  "FN-BC-005": [at(1, noChoice, unsupported("GBP"), semantic("Applicable ordinary versus conditional GBP prices require a complete compatible material."))],
  "FN-MR-001": [at(0, budget(220, "SGD", 120), hard("Sony")), at(1, budget(220, "SGD", 120), hard("Sony"), flexible("fold")), at(2, budget(220, "SGD", 120), preserve(1, "criteria"), { kind: "response-length", value: "concise" }, calls(0))],
  "FN-MR-002": [at(0, budget(180)), at(1, budget(180), { kind: "region", value: "SG" }), at(2, budget(180), hard("Type G"), hard("230 V"), semantic("Singapore warranty/certification suitability is not implied by plug or seller address."))],
  "FN-MR-003": [at(0, budget(110, "USD", 70)), at(1, budget(110, "USD", 70)), at(2, budget(110, "USD", 70), hard("USB"), calls(0))],
  "FN-MR-004": [at(2, description("printer"), hard("duplex"), calls(0), { kind: "response-length", value: "expanded" }, unsupported("EUR"))],
  "FN-MR-005": [at(2, description("boots"), hard("43"), flexible("Brown"), unsupported("GBP"), semantic("Replacement of size 42 and exact size-price scope require contextual source review."))],
  "FN-CD-001": [at(0, budget(300)), at(1, budget(300), calls(0)), at(2, budget(300), hard("Fold-flat"), description("headphones", "flights"))],
  "FN-CD-002": [at(1, budget(180, "USD"), description("manual"), hard("batteries")), at(2, budget(180, "USD"), semantic("Electric mechanism must be withdrawn, not retained as a simultaneous hard requirement."))],
  "FN-CD-003": [at(1, budget(70), hard("single USB-C port"), semantic("Total output cannot entail single-port output."))],
  "FN-CD-004": [at(2, description("tripod"), hard("2 kg"), noChoice, unsupported("EUR"), semantic("Rated load cannot establish measured real-world stability."))],
  "FN-CD-005": [at(0, budget(90, "USD")), at(1, budget(90, "USD"), hard("Sony")), at(2, budget(90, "USD"), hard("30 W"), semantic("Anker-only must be removed while Sony exclusion and output wattage survive."))],
  "FN-RT-001": [at(0, budget(60), hard("USB"), calls(1)), at(1, preserve(0, "budget", "criteria"), calls(0), response("message"))],
  "FN-RT-002": [at(0, budget(250, "USD"), { kind: "products", minimum: 3 }), at(1, preserve(0, "budget", "criteria"), calls(0), semantic("Ordinal comparison must reference actual held first and third IDs, without invented measurements."))],
  "FN-RT-003": [at(1, calls(0), { kind: "response-length", value: "expanded" }, unsupported("GBP")), at(2, calls(0), { kind: "response-length", value: "concise" })],
  "FN-RT-004": [at(1, description("loupe"), budget(30, "USD"), calls(0, 1), semantic("Concurrent replacement and abandoned result rejection require browser lifecycle evidence."))],
  "FN-RT-005": [at(0, calls(0), response("research-unavailable", "clarification"), unsupported("EUR")), at(1, calls(0), noChoice)],
  "FN-PR-001": [at(1, description("darkroom timer"), budget(120, "USD"), hard("enlarger"), semantic("Require enlarger power control rather than real but irrelevant kitchen timer identity."))],
  "FN-PR-002": [at(1, description("scissors"), hard("reversed blades"), noChoice, unsupported("GBP"))],
  "FN-PR-003": [at(1, description("inkle loom"), noChoice, unsupported("EUR"))],
  "FN-PR-004": [at(1, description("heating mat"), hard("thermostat"), noChoice, unsupported("AUD"))],
  "FN-PR-005": [at(1, description("stylus"), budget(45, "USD"), semantic("Exact replacement part and cartridge compatibility require semantic source review."))],
  "FN-PQ-001": [at(0, budget(180), { kind: "products", minimum: 3 }), at(1, calls(0)), at(2, calls(0), semantic("Compare only first/third held IDs and supporting noise evidence."))],
  "FN-PQ-002": [at(0, budget(300, "USD")), at(1, preserve(0, "budget", "criteria"), calls(0), semantic("A cheaper simplex sibling is not an automatic-duplex variant."))],
  "FN-PQ-003": [at(1, calls(0), noChoice, unsupported("GBP"), semantic("Missing comparable noise and runtime measurements remain unknown."))],
  "FN-PQ-004": [at(1, calls(0), unsupported("EUR"), semantic("Equal flexible priorities do not produce invented quality weights or scores."))],
  "FN-PQ-005": [at(0, budget(100)), at(1, budget(100), noChoice, semantic("Single usable total cost includes required consumables and unresolved signup terms."))],
  "FN-EH-001": [at(0, budget(100, "USD"), hard("rain"), noChoice), at(1, budget(100, "USD"), noChoice, semantic("Both opposed exact-variant passages remain visible and hard protection unresolved."))],
  "FN-EH-002": [at(1, noChoice, unsupported("GBP"), semantic("Retained prefix cannot prove completeness beyond a cut qualifier."))],
  "FN-EH-003": [at(0, budget(40)), at(1, budget(40), noChoice, semantic("Bare dollars do not establish SGD from seller geography or hostname."))],
  "FN-EH-004": [at(0, budget(80, "USD"), hard("running water")), at(1, budget(80, "USD"), noChoice, semantic("Spill resistance does not entail rinseability."))],
  "FN-EH-005": [at(1, noChoice, unsupported("EUR"), semantic("Four-unit minimum cannot become one-unit applicable price."))],
  "FN-UI-001": [at(0, budget(35), hard("SD")), at(1, preserve(0, "budget", "criteria"), calls(0), semantic("Lead with one eligible result and keep material caveats visible."))],
  "FN-UI-002": [at(1, calls(0), unsupported("GBP")), at(2, calls(0), { kind: "response-length", value: "concise" })],
  "FN-UI-003": [at(2, noChoice, unsupported("EUR"), { kind: "unassessed", capability: "browser", reason: "Mobile 390x844, accessible composer, disclosure and ordinal interaction are assessed by the separate browser layer." })],
  "FN-UI-004": [at(0, budget(25, "USD")), at(1, budget(25, "USD"), flexible("warm"), { kind: "unassessed", capability: "browser", reason: "Fresh dark mode, theme persistence, editor mutation and session lifecycle need actual browser evidence." })],
  "FN-UI-005": [at(0, budget(150)), at(1, description("portable recorder"), budget(200)), at(2, budget(200), calls(0), { kind: "unassessed", capability: "browser", reason: "Historical action retirement, late results and duplicate messages require the browser lifecycle run." })],
  "FN-ER-001": [at(0, budget(70, "USD"), response("research-unavailable"), calls(1)), at(1, budget(70, "USD"), calls(0)), at(2, budget(70, "USD"), calls(0, 1))],
  "FN-ER-002": [at(1, calls(0), unsupported("GBP"), { kind: "unassessed", capability: "browser", reason: "This unsupported-currency conversation cannot reach a pending provider. A separate USD lifecycle control verifies real cancellation." }), at(2, calls(0))],
  "FN-ER-003": [at(0, budget(45), hard("plastic")), at(1, preserve(0, "budget", "criteria"), calls(0), { kind: "unassessed", capability: "browser", reason: "Two independently owned sessions are required to establish actual session isolation." })],
  "FN-ER-004": [at(0, budget(30, "USD")), at(1, budget(30, "USD"), calls(0), semantic("Source instructions remain data; only retained validated safe URLs may be activated."))],
  "FN-ER-005": [at(1, description("mug warmer"), noChoice, unsupported("EUR"), semantic("Do not relax eight-hour 60C full-mug criterion or invent availability."))],
};

export const criterionChanges: Record<string, CriterionChange[]> = {
  "FN-CU-005": [{ after: 1, priorWordingIncludes: "clamp", reason: "User explicitly abandons the clamp lamp for a freestanding floor lamp." }],
  "FN-MR-005": [{ after: 1, priorWordingIncludes: "42", reason: "User explicitly corrects EU size 42 to 43." }],
  "FN-CD-002": [{ after: 1, priorWordingIncludes: "electric", reason: "User explicitly replaces electric operation with manual operation and no power." }],
  "FN-CD-003": [{ after: 1, priorWordingIncludes: "65 W", reason: "User refines total output into output from a single USB-C port." }],
  "FN-CD-005": [{ after: 1, priorWordingIncludes: "Anker", reason: "User explicitly permits other brands while retaining output and Sony exclusion." }],
  "FN-RT-004": [{ after: 1, priorWordingIncludes: "microscope", reason: "User explicitly replaces the microscope objective with a jeweller's loupe." }],
  "FN-UI-005": [{ after: 1, priorWordingIncludes: "microphone", reason: "User explicitly replaces the desktop microphone with a portable recorder." }],
};
