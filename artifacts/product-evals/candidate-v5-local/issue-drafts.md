# FN-CU-002 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category conversational-understanding.

Expected

- Hard requirement. Product is a travel laptop.
- Hard requirement. Maximum EUR 1200.
- Hard requirement. Weight at most 1.3 kg.
- Use travel context rather than treating trains as a product request.
- Preserve EUR without silently converting it.
- Distinguish missing measured weight from supported compliance.
- Critical failure. Recommendations become train accessories.
- Critical failure. Unknown weight is treated as compliant.
- Critical failure. EUR is silently replaced.

Observed

- Critical criterion:1:1. Expected {"wordingIncludes":"1.3","strength":"hard","meaning":"literal-phrase-only"}. Observed [{"id":"criterion-1","wording":"lightweight","strength":"flexible","origin":{"kind":"message","text":"lightweight"}}].

Reproduce with `npm run eval -- --case FN-CU-002 --out artifacts/product-evals/reproduce-FN-CU-002`. Evidence is FN-CU-002.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-CU-003 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category conversational-understanding.

Expected

- Hard requirement. Portable flashing doorbell receiver.
- Hard requirement. Compatible with Fixture Bell 7.
- Hard requirement. Maximum GBP 80.
- Infer the receiver objective without recommending hearing aids.
- Require model compatibility evidence.
- Do not equate the same radio frequency with proven pairing compatibility.
- Critical failure. Medical devices replace the requested receiver.
- Critical failure. Compatibility is invented.

Observed

- Major description:1:0. Expected ["receiver"]. Observed "".
- Critical criterion:1:1. Expected {"wordingIncludes":"Fixture Bell 7","strength":"hard","meaning":"literal-phrase-only"}. Observed [].

Reproduce with `npm run eval -- --case FN-CU-003 --out artifacts/product-evals/reproduce-FN-CU-003`. Evidence is FN-CU-003.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-CU-004 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category conversational-understanding.

Expected

- Hard requirement. 35 mm slide scanner.
- Hard requirement. Exclude cameras.
- Hard requirement. Maximum USD 250.
- Resolve the intended device from the task.
- Retain the exclusion after the short confirmation.
- Use slide compatibility evidence rather than generic scanner identity.
- Critical failure. Camera bundles are recommended as compliant.
- Critical failure. Document scanners pass without slide support.

Observed

- Major description:1:0. Expected ["slide"]. Observed "".
- Critical budget:1:1. Expected {"amount":250,"currency":"USD"}. Observed null.

Reproduce with `npm run eval -- --case FN-CU-004 --out artifacts/product-evals/reproduce-FN-CU-004`. Evidence is FN-CU-004.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-CU-005 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category conversational-understanding.

Expected

- Hard requirement. Product is now a floor lamp.
- Hard requirement. Freestanding.
- Hard requirement. Maximum SGD 180.
- Treat the second turn as explicit replacement of the whole objective.
- Remove the abandoned clamp requirement and earlier budget.
- Retain the earlier conversation as history.
- Critical failure. Clamp requirement contaminates the new request.
- Critical failure. Earlier request history is overwritten.

Observed

- Major description:1:0. Expected ["floor lamp"]. Observed "desk lamp".
- Critical budget:1:1. Expected {"amount":180,"currency":"SGD"}. Observed {"amount":100,"currency":"SGD"}.
- Critical criterion:1:2. Expected {"wordingIncludes":"freestanding","strength":"hard","meaning":"literal-phrase-only"}. Observed [{"id":"criterion-1","wording":"It must clamp onto the desk.","strength":"hard","origin":{"kind":"message","text":"It must clamp onto the desk."}}].

Reproduce with `npm run eval -- --case FN-CU-005 --out artifacts/product-evals/reproduce-FN-CU-005`. Evidence is FN-CU-005.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-PE-002 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category preference-extraction.

Expected

- Hard requirement. Power bank.
- Hard requirement. Manufacturer Anker only.
- Hard requirement. USB-C PD output at least 30 W.
- Hard requirement. Budget SGD 50 to 90 inclusive.
- Interpret the brand-only reply against the existing product.
- Refine vague fast charging to the explicit output requirement.
- Do not substitute input wattage for output wattage.
- Critical failure. Brand reply resets the product.
- Critical failure. Input charging power proves output compliance.
- Critical failure. Lower bound is lost.

Observed

- Major description:0:0. Expected ["power bank"]. Observed "".
- Major description:1:0. Expected ["power bank"]. Observed "".
- Major description:2:0. Expected ["power bank"]. Observed "".

Reproduce with `npm run eval -- --case FN-PE-002 --out artifacts/product-evals/reproduce-FN-PE-002`. Evidence is FN-PE-002.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-PE-003 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category preference-extraction.

Expected

- Hard requirement. Braille label maker.
- Hard requirement. No phone app required for operation.
- Hard requirement. Maximum USD 180.
- Keep portability flexible.
- Keep Braille output and independent operation hard.
- Accept this open product class without a category registration step.
- Critical failure. Printed bold text is substituted for Braille.
- Critical failure. Portability becomes a mandatory exclusion.
- Critical failure. An app-dependent device is recommended as compliant.

Observed

- Critical budget:1:0. Expected {"amount":180,"currency":"USD"}. Observed null.
- Critical criterion:1:1. Expected {"wordingIncludes":"Braille","strength":"hard","meaning":"literal-phrase-only"}. Observed [].
- Critical criterion:1:2. Expected {"wordingIncludes":"phone app","strength":"hard","meaning":"literal-phrase-only"}. Observed [].
- Major criterion:1:3. Expected {"wordingIncludes":"portability","strength":"flexible","meaning":"literal-phrase-only"}. Observed [].

Reproduce with `npm run eval -- --case FN-PE-003 --out artifacts/product-evals/reproduce-FN-PE-003`. Evidence is FN-PE-003.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-PE-004 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category preference-extraction.

Expected

- Hard requirement. Aquarium filter suitable for a 60 litre freshwater tank.
- Hard requirement. Reusable media.
- Hard requirement. No proprietary disposable cartridges.
- Hard requirement. Maximum AUD 120.
- Keep quietness flexible.
- Preserve capacity and consumable constraints independently.
- Do not infer operating noise from marketing adjectives alone.
- Critical failure. Required cartridge purchases disappear from the comparison.
- Critical failure. Quietness overrides a hard incompatibility.

Observed

- Critical criterion:1:2. Expected {"wordingIncludes":"cartridges","strength":"hard","meaning":"literal-phrase-only"}. Observed [{"id":"criterion-1","wording":"It must suit a 60 litre freshwater tank and take reusable media.","strength":"hard","origin":{"kind":"message","text":"It must suit a 60 litre freshwater tank and take reusable media."}}].
- Major criterion:1:3. Expected {"wordingIncludes":"Quiet","strength":"flexible","meaning":"literal-phrase-only"}. Observed [{"id":"criterion-1","wording":"It must suit a 60 litre freshwater tank and take reusable media.","strength":"hard","origin":{"kind":"message","text":"It must suit a 60 litre freshwater tank and take reusable media."}}].

Reproduce with `npm run eval -- --case FN-PE-004 --out artifacts/product-evals/reproduce-FN-PE-004`. Evidence is FN-PE-004.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-PE-005 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category preference-extraction.

Expected

- Hard requirement. Gooseneck kettle.
- Hard requirement. Variable temperature.
- Hard requirement. 100 V operation.
- Hard requirement. Price below JPY 15000.
- Keep white as a flexible preference.
- Retain the strict below boundary rather than interpreting it as an inclusive maximum.
- Require voltage evidence for the exact variant.
- Critical failure. A 220 V sibling establishes 100 V compatibility.
- Critical failure. White becomes mandatory.
- Critical failure. A JPY 15000 item is described as below budget.

Observed

- Major description:1:0. Expected ["kettle"]. Observed "".
- Critical criterion:1:1. Expected {"wordingIncludes":"100 V","strength":"hard","meaning":"literal-phrase-only"}. Observed [].

Reproduce with `npm run eval -- --case FN-PE-005 --out artifacts/product-evals/reproduce-FN-PE-005`. Evidence is FN-PE-005.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-CC-001 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category contextual-clarification.

Expected

- Hard requirement. Torque screwdriver for bicycle work.
- Hard requirement. Budget USD 60 to 90 inclusive.
- Hard requirement. Adjustable torque range covering 2 to 8 Nm.
- Ask only the unresolved currency after turn 1 if clarification is necessary.
- Retain both money bounds and add the torque requirement.
- Do not ask again for information supplied in either turn.
- Critical failure. Repeated budget clarification.
- Critical failure. A fixed 5 Nm tool is described as covering the required range.

Observed

- Critical budget:1:1. Expected {"amount":90,"currency":"USD","minimum":60}. Observed null.
- Critical criterion:1:2. Expected {"wordingIncludes":"2 to 8","strength":"hard","meaning":"literal-phrase-only"}. Observed [].
- Major calls:1:3. Expected {"minimum":1,"maximum":1}. Observed 0.

Reproduce with `npm run eval -- --case FN-CC-001 --out artifacts/product-evals/reproduce-FN-CC-001`. Evidence is FN-CC-001.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-CC-002 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category contextual-clarification.

Expected

- Hard requirement. Compact sewing machine.
- Hard requirement. Maximum GBP 200.
- Resolve the ambiguous reference with a targeted question when two candidates are present.
- Use the second displayed candidate after clarification.
- Answer from held denim evidence or state the evidence gap without automatic new research.
- Critical failure. Guessing an arbitrary referent produces a confident answer.
- Critical failure. A sibling model's denim claim is used.

Observed

- Major description:2:0. Expected ["sewing"]. Observed "".

Reproduce with `npm run eval -- --case FN-CC-002 --out artifacts/product-evals/reproduce-FN-CC-002`. Evidence is FN-CC-002.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-CC-003 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category contextual-clarification.

Expected

- Hard requirement. Replacement white cane tip.
- Hard requirement. Compatible with an 8 mm screw fitting on the named cane.
- Hard requirement. Maximum USD 25.
- Ask a compatibility question before recommending an attachment.
- Use the answer without repeating a generic preference form.
- Keep unfamiliar accessibility products valid research input.
- Critical failure. Push-fit tips are called compatible.
- Critical failure. Unknown fit is treated as a confident choice.

Observed

- Major calls:0:0. Expected {"minimum":0,"maximum":0}. Observed 1.
- Critical budget:1:1. Expected {"amount":25,"currency":"USD"}. Observed null.
- Critical criterion:1:2. Expected {"wordingIncludes":"8 mm","strength":"hard","meaning":"literal-phrase-only"}. Observed [].

Reproduce with `npm run eval -- --case FN-CC-003 --out artifacts/product-evals/reproduce-FN-CC-003`. Evidence is FN-CC-003.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-CC-004 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category contextual-clarification.

Expected

- Hard requirement. Daylight lamp for painting miniatures.
- Hard requirement. Adjustable brightness.
- Hard requirement. No budget constraint.
- Accept the explicit budget skip.
- Research without repeatedly requesting a budget.
- Do not invent a default price ceiling.
- Critical failure. Budget clarification loop.
- Critical failure. An undeclared price ceiling filters results.

Observed

- Major description:1:0. Expected ["lamp"]. Observed "".
- Critical criterion:1:1. Expected {"wordingIncludes":"brightness","strength":"hard","meaning":"literal-phrase-only"}. Observed [].
- Major calls:1:3. Expected {"minimum":1,"maximum":1}. Observed 0.

Reproduce with `npm run eval -- --case FN-CC-004 --out artifacts/product-evals/reproduce-FN-CC-004`. Evidence is FN-CC-004.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-BC-001 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category budget-currency.

Expected

- Hard requirement. USB-C dock supporting two monitors.
- Hard requirement. Budget USD 100 to 160 inclusive.
- Change the currency label while retaining the stated numeric bounds.
- Do not apply an unrequested exchange rate.
- Reassess prior observations against USD evidence.
- Critical failure. Currency correction converts the numbers.
- Critical failure. SGD observations establish USD affordability.
- Critical failure. A bound is dropped.

Observed

- Critical budget:1:1. Expected {"amount":160,"currency":"USD","minimum":100}. Observed {"amount":160,"currency":"SGD","minimum":100}.

Reproduce with `npm run eval -- --case FN-BC-001 --out artifacts/product-evals/reproduce-FN-BC-001`. Evidence is FN-BC-001.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-BC-002 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category budget-currency.

Expected

- Hard requirement. Hand coffee grinder.
- Hard requirement. Budget EUR 80 to 130 inclusive.
- Retain EUR and both bounds through the material preference.
- Keep steel flexible because the user expressed liking rather than a requirement.
- State any unsupported-currency capability gap honestly.
- Critical failure. Budget becomes SGD or USD.
- Critical failure. Material preference deletes a budget bound.

Observed

- Major description:1:0. Expected ["grinder"]. Observed "".

Reproduce with `npm run eval -- --case FN-BC-002 --out artifacts/product-evals/reproduce-FN-BC-002`. Evidence is FN-BC-002.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-BC-003 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category budget-currency.

Expected

- Hard requirement. Fountain pen.
- Hard requirement. Fine nib.
- Hard requirement. Maximum JPY 6000.
- Treat around JPY 4000 as a target unless the user establishes a new hard ceiling.
- Keep the existing explicit cap.
- Do not interpret 4000 as four or infer decimal cents.
- Critical failure. Invented numeric conversion.
- Critical failure. Earlier cap disappears.
- Critical failure. Wrong nib variant receives the qualifying price.

Observed

- Major description:1:0. Expected ["fountain pen"]. Observed "".

Reproduce with `npm run eval -- --case FN-BC-003 --out artifacts/product-evals/reproduce-FN-BC-003`. Evidence is FN-BC-003.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-BC-004 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category budget-currency.

Expected

- Hard requirement. Cordless soldering iron.
- Hard requirement. Maximum AUD 150.
- Hard requirement. No minimum price.
- Remove only the explicitly withdrawn minimum.
- Keep the currency and maximum.
- Allow cheaper qualifying options after turn 2.
- Critical failure. Removing the minimum also removes the maximum.
- Critical failure. The withdrawn floor remains active.

Observed

- Major description:1:0. Expected ["soldering iron"]. Observed "".

Reproduce with `npm run eval -- --case FN-BC-004 --out artifacts/product-evals/reproduce-FN-BC-004`. Evidence is FN-BC-004.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-MR-001 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category preference-retention.

Expected

- Hard requirement. Closed-back headphones.
- Hard requirement. Exclude Sony products.
- Hard requirement. Budget SGD 120 to 220 inclusive.
- Add folding as a flexible preference.
- Preserve all hard constraints through the response-length change.
- Keep earlier response snapshots unchanged.
- Critical failure. Short mode removes constraints.
- Critical failure. Preference update overwrites earlier messages.
- Critical failure. Budget loses its minimum.

Observed

- Critical budget:0:0. Expected {"amount":220,"currency":"SGD","minimum":120}. Observed null.
- Critical criterion:0:1. Expected {"wordingIncludes":"Sony","strength":"hard","meaning":"exclude"}. Observed [].
- Critical budget:1:0. Expected {"amount":220,"currency":"SGD","minimum":120}. Observed null.
- Critical criterion:1:1. Expected {"wordingIncludes":"Sony","strength":"hard","meaning":"exclude"}. Observed [{"id":"criterion-1","wording":"I'd prefer something that folds.","strength":"flexible","origin":{"kind":"message","text":"I'd prefer something that folds."}}].
- Critical budget:2:0. Expected {"amount":220,"currency":"SGD","minimum":120}. Observed null.

Reproduce with `npm run eval -- --case FN-MR-001 --out artifacts/product-evals/reproduce-FN-MR-001`. Evidence is FN-MR-001.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-MR-003 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category preference-retention.

Expected

- Hard requirement. Tenkeyless keyboard.
- Hard requirement. USB operation without Bluetooth.
- Hard requirement. Budget USD 70 to 110 inclusive.
- Add quieter operation as a preference without deleting wired operation.
- Retain both budget bounds exactly.
- Do not confuse wireless-only USB charging with USB data operation.
- Critical failure. USB charging is accepted as wired typing.
- Critical failure. Budget changes on the reminder.

Observed

- Critical budget:0:0. Expected {"amount":110,"currency":"USD","minimum":70}. Observed null.
- Critical budget:1:0. Expected {"amount":110,"currency":"USD","minimum":70}. Observed null.
- Critical budget:2:0. Expected {"amount":110,"currency":"USD","minimum":70}. Observed null.
- Critical criterion:2:1. Expected {"wordingIncludes":"USB","strength":"hard","meaning":"literal-phrase-only"}. Observed [{"id":"criterion-1","wording":"Make it quieter.","strength":"flexible","origin":{"kind":"message","text":"Make it quieter."}}].

Reproduce with `npm run eval -- --case FN-MR-003 --out artifacts/product-evals/reproduce-FN-MR-003`. Evidence is FN-MR-003.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-MR-004 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category preference-retention.

Expected

- Hard requirement. Monochrome laser printer.
- Hard requirement. Automatic duplex printing.
- Hard requirement. Maximum EUR 180.
- Add consumable cost as a flexible preference.
- Expand held evidence without new research.
- Do not substitute manual duplex or scanner duplex for automatic print duplex.
- Critical failure. Detail mode triggers paid dispatch.
- Critical failure. A different duplex feature satisfies the criterion.
- Critical failure. Printer budget is silently converted to lifetime cost.

Observed

- Major description:2:0. Expected ["printer"]. Observed "".
- Critical criterion:2:1. Expected {"wordingIncludes":"duplex","strength":"hard","meaning":"literal-phrase-only"}. Observed [].
- Major response-length:2:3. Expected "expanded". Observed "concise".

Reproduce with `npm run eval -- --case FN-MR-004 --out artifacts/product-evals/reproduce-FN-MR-004`. Evidence is FN-MR-004.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-MR-005 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category preference-retention.

Expected

- Hard requirement. Waterproof hiking boots.
- Hard requirement. EU size 43.
- Hard requirement. Maximum GBP 140.
- Replace only the size constraint.
- Keep brown flexible.
- Ensure any qualifying price applies to the selected size and variant.
- Critical failure. Size 42 remains active.
- Critical failure. Price from an unavailable different size proves affordability.
- Critical failure. Brown becomes a hard filter.

Observed

- Major description:2:0. Expected ["boots"]. Observed "".
- Critical criterion:2:1. Expected {"wordingIncludes":"43","strength":"hard","meaning":"literal-phrase-only"}. Observed [{"id":"criterion-1","wording":"Brown would be nice.","strength":"flexible","origin":{"kind":"message","text":"Brown would be nice."}}].

Reproduce with `npm run eval -- --case FN-MR-005 --out artifacts/product-evals/reproduce-FN-MR-005`. Evidence is FN-MR-005.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-CD-002 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category corrections-dissatisfaction.

Expected

- Hard requirement. Manual burr grinder.
- Hard requirement. No battery or mains power.
- Hard requirement. Maximum USD 180.
- Apply the explicit correction to the power mechanism.
- Do not carry electric operation forward.
- Keep budget without requiring the repeated third turn for correctness.
- Critical failure. Electric products remain eligible.
- Critical failure. Correction resets the budget.

Observed

- Major description:1:1. Expected ["manual"]. Observed "electric burr grinder".
- Critical criterion:1:2. Expected {"wordingIncludes":"batteries","strength":"hard","meaning":"literal-phrase-only"}. Observed [].

Reproduce with `npm run eval -- --case FN-CD-002 --out artifacts/product-evals/reproduce-FN-CD-002`. Evidence is FN-CD-002.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-CD-003 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category corrections-dissatisfaction.

Expected

- Hard requirement. USB-C charger.
- Hard requirement. Maximum SGD 70.
- Hard requirement. At least 65 W from one USB-C port.
- Distinguish total output from per-port output.
- Reassess the rejected candidate using complete port evidence.
- Do not defend the earlier recommendation using the same inadequate total-output claim.
- Critical failure. Combined wattage proves single-port output.
- Critical failure. Known adverse evidence is ignored.

Observed

- Critical budget:1:0. Expected {"amount":70,"currency":"SGD"}. Observed null.
- Critical criterion:1:1. Expected {"wordingIncludes":"single USB-C port","strength":"hard","meaning":"literal-phrase-only"}. Observed [].

Reproduce with `npm run eval -- --case FN-CD-003 --out artifacts/product-evals/reproduce-FN-CD-003`. Evidence is FN-CD-003.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-CD-004 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category corrections-dissatisfaction.

Expected

- Hard requirement. Tripod for a mirrorless camera.
- Hard requirement. Maximum EUR 100.
- Hard requirement. Rated support for at least 2 kg.
- Change flexible priority toward stability without inventing a quality score.
- Keep uncertain real-world stability explicit.
- Do not infer stable performance solely from the load rating.
- Critical failure. An invented stability rating determines a confident choice.
- Critical failure. Price ceiling disappears when priority changes.

Observed

- Major description:2:0. Expected ["tripod"]. Observed "".

Reproduce with `npm run eval -- --case FN-CD-004 --out artifacts/product-evals/reproduce-FN-CD-004`. Evidence is FN-CD-004.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-CD-005 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category corrections-dissatisfaction.

Expected

- Hard requirement. Power bank.
- Hard requirement. Maximum USD 90.
- Hard requirement. USB-C output at least 30 W.
- Hard requirement. Exclude Sony.
- Hard requirement. No Anker-only restriction.
- Remove only the explicitly relaxed brand restriction.
- Add Sony exclusion and preserve output power.
- Do not generalize one relaxed criterion into relaxing every hard constraint.
- Critical failure. Power requirement is relaxed.
- Critical failure. Sony becomes eligible.
- Critical failure. Anker remains mandatory.

Observed

- Critical budget:0:0. Expected {"amount":90,"currency":"USD"}. Observed null.
- Critical budget:1:0. Expected {"amount":90,"currency":"USD"}. Observed null.
- Critical criterion:1:1. Expected {"wordingIncludes":"Sony","strength":"hard","meaning":"exclude"}. Observed [].
- Critical budget:2:0. Expected {"amount":90,"currency":"USD"}. Observed null.
- Critical criterion:2:1. Expected {"wordingIncludes":"30 W","strength":"hard","meaning":"literal-phrase-only"}. Observed [].

Reproduce with `npm run eval -- --case FN-CD-005 --out artifacts/product-evals/reproduce-FN-CD-005`. Evidence is FN-CD-005.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-RT-001 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category research-selection.

Expected

- Hard requirement. Desk fan.
- Hard requirement. USB powered.
- Hard requirement. Maximum SGD 60.
- Research may run for turn 1.
- Answer application help locally on turn 2.
- Leave shopping preferences intact and record zero additional research dispatches for turn 2.
- Critical failure. App-help turn triggers research.
- Critical failure. App-help wording becomes a product requirement.

Observed

- Critical budget:0:0. Expected {"amount":60,"currency":"SGD"}. Observed null.
- Critical criterion:0:1. Expected {"wordingIncludes":"USB","strength":"hard","meaning":"literal-phrase-only"}. Observed [].
- Major calls:0:2. Expected {"minimum":1,"maximum":1}. Observed 0.

Reproduce with `npm run eval -- --case FN-RT-001 --out artifacts/product-evals/reproduce-FN-RT-001`. Evidence is FN-RT-001.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-RT-003 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category research-selection.

Expected

- Hard requirement. Compact induction hob.
- Hard requirement. Maximum GBP 90.
- Both presentation turns use held evidence.
- Preserve identical research provenance and zero additional dispatches.
- Apply the latest requested response length.
- Critical failure. Detail toggles trigger research.
- Critical failure. Reformatting changes source claims or prices.

Observed

- Major response-length:1:1. Expected "expanded". Observed "concise".

Reproduce with `npm run eval -- --case FN-RT-003 --out artifacts/product-evals/reproduce-FN-RT-003`. Evidence is FN-RT-003.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-PR-001 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category product-relevance.

Expected

- Hard requirement. Darkroom timer.
- Hard requirement. Can control enlarger power.
- Hard requirement. Maximum USD 120.
- Hard requirement. Exclude ordinary kitchen countdown timers.
- Require source support for the actual darkroom function.
- Keep identity and request match as separate assessments.
- Do not recommend a real but irrelevant timer.
- Critical failure. Valid product identity alone establishes relevance.
- Critical failure. Kitchen timer is the confident choice.

Observed

- Critical criterion:1:2. Expected {"wordingIncludes":"enlarger","strength":"hard","meaning":"literal-phrase-only"}. Observed [].

Reproduce with `npm run eval -- --case FN-PR-001 --out artifacts/product-evals/reproduce-FN-PR-001`. Evidence is FN-PR-001.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-PR-002 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category product-relevance.

Expected

- Hard requirement. Left-handed fabric scissors.
- Hard requirement. Reversed blades for left-handed cutting.
- Hard requirement. Maximum GBP 35.
- Distinguish handle ergonomics from blade orientation.
- Expose absent blade evidence.
- Require exact variant evidence.
- Critical failure. Ambidextrous handles prove reversed blades.
- Critical failure. Right-handed sibling evidence is reused.

Observed

- Major description:1:0. Expected ["scissors"]. Observed "".

Reproduce with `npm run eval -- --case FN-PR-002 --out artifacts/product-evals/reproduce-FN-PR-002`. Evidence is FN-PR-002.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-PR-003 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category product-relevance.

Expected

- Hard requirement. Tabletop inkle loom for narrow bands.
- Hard requirement. Maximum EUR 90.
- Hard requirement. Exclude knitting machines.
- Accept an unfamiliar open product description.
- Refine the product class from the correction.
- Return unresolved alternatives honestly when exact-class evidence is absent.
- Critical failure. A fixed category menu rejects the request.
- Critical failure. Textile-related products automatically count as relevant.

Observed

- Major description:1:0. Expected ["inkle loom"]. Observed "".

Reproduce with `npm run eval -- --case FN-PR-003 --out artifacts/product-evals/reproduce-FN-PR-003`. Evidence is FN-PR-003.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-PR-004 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category product-relevance.

Expected

- Hard requirement. Heating mat suitable for a 5 litre fermentation jar.
- Hard requirement. Thermostat included.
- Hard requirement. Maximum AUD 60.
- Hard requirement. Exclude uncontrolled mats.
- Assess suitability for the stated use rather than matching heating-mat keywords.
- Keep bundle contents and variant scope explicit.
- Do not silently add a separate thermostat cost outside the budget.
- Critical failure. Bare mat is presented as a thermostat bundle.
- Critical failure. Different intended use substitutes for evidence.

Observed

- Major description:1:0. Expected ["heating mat"]. Observed "".
- Critical criterion:1:1. Expected {"wordingIncludes":"thermostat","strength":"hard","meaning":"literal-phrase-only"}. Observed [].

Reproduce with `npm run eval -- --case FN-PR-004 --out artifacts/product-evals/reproduce-FN-PR-004`. Evidence is FN-PR-004.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-PR-005 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category product-relevance.

Expected

- Hard requirement. Replacement stylus only.
- Hard requirement. Compatible with Fixture Audio C12 cartridge.
- Hard requirement. Maximum USD 45.
- Preserve part-level identity and compatibility.
- Exclude whole cartridges as substitutes unless clearly labelled alternatives outside the request.
- Do not infer compatibility from visual resemblance.
- Critical failure. A whole cartridge is called the requested part.
- Critical failure. Compatibility is invented.

Observed

- Major description:1:0. Expected ["stylus"]. Observed "".
- Critical budget:1:1. Expected {"amount":45,"currency":"USD"}. Observed null.

Reproduce with `npm run eval -- --case FN-PR-005 --out artifacts/product-evals/reproduce-FN-PR-005`. Evidence is FN-PR-005.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-PQ-002 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category comparison-quality.

Expected

- Hard requirement. Compact document scanner.
- Hard requirement. Automatic duplex scanning.
- Hard requirement. Maximum USD 300.
- Explain when the cheaper price is for a simplex sibling variant.
- Keep each displayed price bound to its exact variant.
- Do not rank the incompatible variant as better value for the stated need.
- Critical failure. Sibling price is attached to the duplex model.
- Critical failure. Price explanation hides missing duplex.

Observed

- Critical budget:0:0. Expected {"amount":300,"currency":"USD"}. Observed null.

Reproduce with `npm run eval -- --case FN-PQ-002 --out artifacts/product-evals/reproduce-FN-PQ-002`. Evidence is FN-PQ-002.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-EH-001 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category evidence-honesty.

Expected

- Hard requirement. Backpack.
- Hard requirement. Protection of contents in heavy rain.
- Hard requirement. Maximum USD 100.
- Preserve both conflicting passages for the same variant.
- Do not confidently satisfy the hard protection criterion.
- Explain the conflict with source references.
- Critical failure. Positive source suppresses contradictory evidence.
- Critical failure. Conflicted waterproofing authorizes a confident fit.

Observed

- Critical budget:0:0. Expected {"amount":100,"currency":"USD"}. Observed null.
- Critical criterion:0:1. Expected {"wordingIncludes":"rain","strength":"hard","meaning":"literal-phrase-only"}. Observed [].
- Critical budget:1:0. Expected {"amount":100,"currency":"USD"}. Observed null.

Reproduce with `npm run eval -- --case FN-EH-001 --out artifacts/product-evals/reproduce-FN-EH-001`. Evidence is FN-EH-001.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-EH-004 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category evidence-honesty.

Expected

- Hard requirement. Keyboard safe to rinse under running water.
- Hard requirement. Maximum USD 80.
- Explain that spill resistance does not establish rinseability.
- Distinguish literal supporting quotation from an unsupported interpretation.
- Keep the hard criterion unknown or contradicted as the complete source warrants.
- Critical failure. Quote containment is treated as semantic proof.
- Critical failure. Spill-resistant becomes washable.

Observed

- Critical budget:0:0. Expected {"amount":80,"currency":"USD"}. Observed null.
- Critical criterion:0:1. Expected {"wordingIncludes":"running water","strength":"hard","meaning":"literal-phrase-only"}. Observed [].
- Critical budget:1:0. Expected {"amount":80,"currency":"USD"}. Observed null.

Reproduce with `npm run eval -- --case FN-EH-004 --out artifacts/product-evals/reproduce-FN-EH-004`. Evidence is FN-EH-004.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-UI-005 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category chat-interaction.

Expected

- Hard requirement. Current objective is a portable recorder.
- Hard requirement. Maximum SGD 200.
- Keep microphone messages visible as history.
- Retired selection and research controls cannot modify or rerun the abandoned request.
- Comparison uses the current recorder results.
- No duplicate assistant message appears during request replacement.
- Critical failure. Stale historical action triggers research.
- Critical failure. Abandoned result overwrites the recorder response.
- Critical failure. Current comparison uses microphone IDs.

Observed

- Major description:1:0. Expected ["portable recorder"]. Observed "desktop microphone".
- Critical budget:1:1. Expected {"amount":200,"currency":"SGD"}. Observed {"amount":150,"currency":"SGD"}.
- Critical budget:2:0. Expected {"amount":200,"currency":"SGD"}. Observed {"amount":150,"currency":"SGD"}.

Reproduce with `npm run eval -- --case FN-UI-005 --out artifacts/product-evals/reproduce-FN-UI-005`. Evidence is FN-UI-005.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.

---

# FN-ER-005 product evaluation failure

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Category recovery-safety.

Expected

- Hard requirement. Battery-powered mug warmer.
- Hard requirement. Keeps a full mug at 60 C for eight hours.
- Hard requirement. Maximum EUR 25.
- Hard requirement. Do not relax requirements.
- Return no confident compliant choice when the provider supplies no supporting evidence.
- Explain the missing evidence or failed requirements.
- Any adjacent alternatives remain explicitly outside the hard requirements.
- Do not fabricate product availability.
- Critical failure. Impossible-to-establish fit is invented.
- Critical failure. Runtime or temperature requirement is silently relaxed.
- Critical failure. Empty evidence selects fallback fixtures.

Observed

- Major description:1:0. Expected ["mug warmer"]. Observed "".

Reproduce with `npm run eval -- --case FN-ER-005 --out artifacts/product-evals/reproduce-FN-ER-005`. Evidence is FN-ER-005.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.
