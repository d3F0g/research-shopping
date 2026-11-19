# Independent audit of the second genuine Exa result

The shopper asked for headphones for music under SGD400, comparing sound quality and battery life. The captured result contains enough literal evidence for useful ATH-M50xBT2 and Edifier 2025-edition specification leads, plus complete unverified HN Teal price context. Returning only one identity card is honest about the application's output, but does not satisfy that useful-comparison objective. This is a ground-truth audit, not an architecture selection or implementation approval.

The application commit was `68f8d849c757fae5ba6bef0ae7038a30549de73d`. The recorded second request returned five sources, one HN Teal 800073 identity, zero facts and no price. It reported US$0.007, bringing the two recorded calls to US$0.014. The initial two-call authorization is exhausted even though the recorded technical ledger says `stopped:false`. This audit made zero provider calls.

## Capture integrity and offset convention

The diagnostic is 32,379 bytes with mode 0600. Its SHA256 is `96e01bb3cbd6e195ff32d1daebc898b1a92eb4b0cf712e2dc9e80d6a0ce6f97c`. Native text is complete, 2,009 UTF-16 units and 2,011 UTF-8 bytes, with SHA256 `85bd6ac7c6eda37c89ce740b162b4f1c5d7fe4fda84de246118495c57979d39f`.

All five raw highlights have `truncated:false`, with lengths 3502, 3234, 2096, 2380 and 1281. All sixteen native/title/URL/highlight field hashes and length records were recomputed and matched. Complete diagnostic retention does not remove literal `...` gaps inside an Exa highlight.

`oracles.json` preserves the exact native and source field records as a clearly labeled diagnostic-field bundle. It also records each literal source span, its hash, normalized display quote and provenance. Offsets below refer to `results[sourceIndex].highlights[0].text`, are zero-based UTF-16 units, and use an exclusive end. All five strings happen to contain only BMP code points, so code-point offsets coincide. No source/native field was rewritten. No replay envelope was created. The allowlisted diagnostic is not a full HTTP response capture.

## Per-source oracles

**1. Audio-Technica ATH-M50xBT2.** Admit the exact model ID using the repeated model heading and the complete definition at `[123,230)`. That definition calls the same model the second generation of M-Series wireless over-ear headphones. A space inside a model name is not necessary identity evidence, and the decorative page title must not become the model name.

The complete driver statement at `[231,400)` is safe attributable evidence. It starts `These headphones feature 45 mm large aperture drivers in a wireless design` and continues through the explicit comparison with ATH-M50 studio headphones. Keep the whole sentence. The leading driver claim belongs to ATH-M50xBT2; the comparison does not authorize borrowing ATH-M50 specifications or asserting measured sound superiority.

The complete battery sentence at `[1522,1756)` is safe within the same exact-model section before the first gap at 2284. It says up to 50 hours on a continuous full charge, up to 3 hours of use on a 10-minute rapid charge via USB-C, and includes a manufacturer superlative. Keep every qualification and attribute the superlative. The `[1212,1756)` contiguous context also includes the exact-model microphone paragraph that precedes this pronoun-based battery statement. The native battery hint changes initial case and omits most of that sentence; the driver hint omits the surrounding predicate, wireless-design qualification and comparison.

`From: SALE SGD 228.00` at `[70,91)` can be retained as observed starting-price context under the repeated exact model heading. Keep both `From` and `SALE`. The earlier unlabelled SGD 380.41 does not establish a list price, and the excerpt establishes no fixed payable price or current affordability. The native LDAC/AAC hint is literal at `[2428,2476)` but lies after explicit gaps, so it must not attach without fresh exact-model ownership. The later generic Specifications table does not itself re-anchor that model.

The useful driver, battery and starting-price evidence fits two contiguous citation windows, `[0,400)` and `[1212,1756)`, each below the existing 640-character display limit after whitespace normalization. No stitching is necessary.

**2. Sony Gain City.** Source-only is acceptable for this bounded extension. The physical line `[25,79)` preserves `SONY WH-1000XM5 WIRELESS HEADSET - BLACK WH1000XM5/BME`, but it is unmarked and differs from the marketing title. It should not motivate an unrelated generic unmarked-header pipeline merely to make all five sources admit.

The first gap is `[244,247)`. Later complete base-model prose does not prove that exact Black/SKU identity. Battery text `[971,1114)` includes both up to 30 hours and 3 hours from a 3-minute charge. A later runtime record `[2249,2339)` distinguishes Max. 30 hours with NC on from Max. 40 hours with NC off. None may become an unqualified number or transfer across the gap to Black WH1000XM5/BME.

The native `Industry-leading...` changes case and is only part of a full sentence. `High-resolution audio with LDAC technology` is not a contiguous match even after case/whitespace alignment; it recomposes source wording. Its nearby source sentence `[832,970)` has additional qualification. Price `[157,242)` carries member discount, reward points and U.P. context. Withhold a structured price; never emit S$329 alone. Both raw `In stock` occurrences remain unverified page text.

**3. HN Sennheiser Teal 800073.** Keep the complete admitted heading and all colour/model designation. The native name appends Harvey Norman Singapore, while the identity hint omits only the Markdown marker. That mismatch is a proposal-resolution problem, not missing source identity.

The full contiguous price span `[74,115)` normalizes to `S$ 349 was S$ 499 SGD You Save S$ 150`. It is before the first gap at 117 and supports an unverified complete price-context quote. Native `S$ 349 was S$ 499` is only a prefix. The physical source has separate lines for SGD and savings. Diagnostics independently record unresolved context for the first price fragment `[73,92)` and a native-name mismatch. Fixing the native name alone cannot recover the complete multiline price record. Currency-only continuation must be resolved as part of that real price block, without a general rule to ignore unknown prose.

All native specification proposals remain prohibited for Teal. The driver/aptX statement `[237,387)`, battery sentence `[388,507)` and ANC statement `[781,916)` follow the first gap. Their nearby model reference omits Teal and 800073. Later Teal/model table text after further gaps does not retroactively bind earlier excerpts. Do not use name alignment to resurrect these facts. Identity and the full price context fit one contiguous `[0,117)` window.

**4. Stereo Edifier WH950NB (2025 edition).** The full heading proves the exact edition and singular Headphone category. The en-dash merchant suffix belongs to the page title. It is not part of the product identity. Admit the literal heading without stripping the edition.

The complete pre-gap driver sentence `[208,270)` is safe. It states `Titanium-coated 40mm drivers deliver powerful, balanced sound.` The native hint omits its terminal period. The same words recur in a later post-gap bullet, so string matching alone must not select the later occurrence. Resolve the complete owned pre-gap statement. The preceding two unlabelled price records cannot establish sale/list roles, but their unknown price roles must not erase the otherwise clear same-product topic and complete driver sentence.

The codec text `[271,340)` includes `for near-lossless quality`, which the native proposal drops. It ends with four periods. That run could be interpreted as a sentence period followed by an ellipsis, but the captured gap tokenization is not unambiguous. I do not require this interpretation or count the codec claim toward minimum yield. Withholding it is acceptable. Any later admission must retain the full qualification and justify the boundary, rather than turn the cropped native hint into a complete proposition.

The native 80-hour hint at `[660,683)` belongs to the bullet `[658,722)` after the first explicit gap; it also drops the 13-hour/15-minute fast-charge qualification. Subsequent named references only say WH950NB, omitting 2025 edition. Neither that battery claim nor the later codec statement `[1655,1775)` may attach to the selected edition. Do not report 80 hours as this lead's verified or attributable runtime.

Both unlabelled amounts `[70,92)` remain a null structured price. No sale/list order can be inferred. Identity and the safe driver quote fit one contiguous `[0,340)` citation window.

**5. Stereo Sennheiser Momentum 4.** The literal singular-class heading can support optional identity-only discovery. Preserve its wording. Do not append Graphite from the URL or merge it with the Teal 800073 source. No native observation exists, so there is no extraction to reconstruct. Two unlabelled prices `[44,66)` remain ambiguous. All later prose follows the gap at 68 and must not become facts for the selected lead. This identity-only result does not count toward useful-comparison acceptance.

## Useful comparison and visual assessment

A meaningful offline acceptance target is two independently justified useful leads, ATH-M50xBT2 and the full Edifier 2025 edition, with the complete ATH driver and battery sentences and the complete Edifier driver sentence. Compare their quoted driver construction/size without treating diameter as sound quality. State the ATH battery qualification and that the selected Edifier edition's battery is not attributable from the safe excerpt. Manufacturer/merchant adjectives remain attributed claims. Complete HN price context should remain useful while Sony and the unlabelled Stereo amounts remain unavailable as structured prices. Multiple names, category-only facts, source counts or a comparison of empty cards are insufficient. All five sources need not admit.

I inspected all four original screenshots. Desktop shows the minimal dark chat, the actual request, one Teal identity card, no price and no established specifications. Mobile preserves the complete wrapped designation, readable evidence/source controls, uncertainty and the bottom composer without obvious horizontal clipping. The ordinary thanks turn remains an ordinary visible message. These images are honest about the partial output, but contain no useful specification comparison. They do not independently establish keyboard operation, hidden scroll content, cancellation or current merchant truth.

`oracles.json` contains 21 native alignment records, including the missing fifth observation, complete literal source spans, gap locations, safe citation windows and the minimum useful-yield criteria. `build-oracles.py` reproduces field/hash/offset verification without importing application code, starting a server or contacting a provider. Original input hashes are recorded and rechecked. No application, capture, historical oracle, environment, database or GitHub file was changed.

Boundary Discipline kept native proposals separate from source authority and preserved gaps and full variants. Test Behavior, Not Implementation defined useful quoted output rather than card-count success. Prove It Works required inspecting the physical text and actual proof images. Build the Lever produced executable hash/span verification. This audit does not select either architecture candidate or approve a merge or additional paid call.
