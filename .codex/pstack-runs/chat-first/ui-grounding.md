# Fieldnote chat UI grounding

The user wants a premium minimal chat interface with dark default, retained messages, bottom composer, optional inline preferences, and product research inside assistant messages.

Inspected checkout `/Users/josiahwong/Documents/research-shopping` at `151fa506f58f4171add9f5efd684da809ee3248f`. Existing unrelated dirt includes `package-lock.json`, `.agents/skills/build-with-exa/`, and `skills-lock.json`. No repository edits, `.env` reads, app launch, live calls, or GitHub mutations occurred in this delegate task. Root separately reports baseline runtime verification.

## Components and flow

| Component | File | Responsibility |
| --- | --- | --- |
| `App` | `src/client/App.tsx` | All preferences, drafts, current request/result, selection, IDs, revisions, controllers, dashboard composition. |
| `PreferencePanel` | `src/client/PreferencePanel.tsx` | Controlled hard-limit and flexible-preference editor. |
| `Results`, `ProductCard`, `Comparison` | `src/client/ResearchResults.tsx` | Answer, fixture cards, evidence, comparison, optional sources, and actual recorded provider outcomes. |
| `Handoff` | `src/client/ResearchResults.tsx:593` | Exact validated product-page link, fixture offer, safe host, limitation, reset. |
| `WebResearch` | `src/client/WebResearch.tsx` | Explicit optional request, controller, source response, retry, and disclosures. |
| API parsers | `src/client/api.ts` | Runtime response validation and exact catalog handoff identity checks. |
| Domain contracts | `src/domain/contracts.ts` | Separate hard/soft preferences, complete JSON response union, provider outcomes, selection. No transcript request field. |

1. `App.tsx:60-110` initializes in-memory tab state. No persistence or server session is involved.
2. Editor callbacks preserve unrelated fields. New priorities move to first position. Category changes clear incompatible fields with explanation. See `PreferencePanel.tsx:59-80` and `App.tsx:191-230`.
3. Budget and brand drafts differ from accepted preferences. Invalid budget remains visible, preserves the prior accepted cap, and blocks submission. Brand draft commits before requests. See `App.tsx:152-189,233-255`.
4. `submitTurn` sends message plus accepted preferences. Empty text becomes `Show options` when category exists. The form currently uses `outcome ? "" : input`. See `App.tsx:258-294,501-506`.
5. `cancelWork` aborts turn/selection and increments IDs. Turn responses must match turn ID, preference revision, and input revision. Successful response replaces `outcome`, updates preferences, and clears input unless it is a domain error. See `App.tsx:112-141,275-328`.
6. Selecting sends product ID plus current global preferences. Client schema and `isSafeCatalogHandoff` reject ID/name/URL/host mismatches. Success replaces `Results` with `Handoff`. See `App.tsx:331-360,629-644` and `api.ts:36-60`.
7. Reset aborts work and clears preferences, drafts, current response, last request, handoff, errors, and notes. See `App.tsx:363-379`.

## Existing official foundation

`components.json` declares `base-nova`, client React, semantic tokens, Lucide, and aliases. `package.json` declares shadcn 4.23.0 and `@shadcn/react` 0.3.1. `artifacts/frontend-standard/provenance/registry-manifest.json` retains 21 official registry snapshots with hashes. `docs/frontend-standard.md:5-24` records CLI provenance and documented AI Elements compositions. Hashes and current websites were not reverified here.

The installed components already cover chat. Conversation uses Message Scroller, Message, and Bubble. Composer uses Input Group textarea/button. Preferences use Field, Input, Native Select, Checkbox, Separator, Collapsible, and Sheet. Products use Card/Badge/Button. Evidence uses Trace/Hover Card. Comparison uses Collapsible/Table. Failures use Alert/Empty. The requested change does not require replacing these components.

## Dashboard removal boundaries

- `App.tsx:423-498` owns topbar, intro, permanent desktop preferences, mobile Sheet. The reusable editor value already exists at `381-400`.
- `App.tsx:499-568` owns the top composer card and starter prompts. Move composition below the transcript.
- `App.tsx:569-648` owns the single two-item exchange. `lastMessage`, `outcome`, and `selection` at `85-94` are not retained history. Edits/submission clear the response.
- `ResearchResults.tsx:511-518` adds dashboard framing. The useful answer at `521` can lead the assistant message. Keep product/evidence/comparison components inside that message.
- `styles.css:36-55` has light-only tokens. `index.html:6` has light theme-color. `main.tsx` has no theme provider.
- `styles.css:72-120,191-240,246-258` owns the dashboard grid, top composer, footer, and compact-after-request rules.
- The official scroller supports actual viewport scrolling. Current CSS forces root/viewport to auto height and visible overflow at `styles.css:109-111`; `App.tsx:569` disables autoscroll. Reconsider these overrides for viewport-height chat and preserve `min-height: 0` through flex containers.

## History invariants and hazards

- Store stable retained messages with their request and accepted preference snapshot. Keep visual history separate from latest actionable state. Prior cards do not establish eligibility under newly edited constraints.
- Preserve revision guards and actual aborts when typing, editing preferences, starting another turn, selecting, or resetting. Historical text can stay while work is canceled.
- `WebResearch.tsx:46-50` aborts only on unmount. It has no active/revision input and no effect keyed to changed product IDs/preferences. Current App clears/replaces Results to enforce cancellation. Retaining old components removes that mechanism. Add explicit invalidation or make historical sources inert snapshots.
- Historical cards currently invoke the global selection handler using current preferences at `App.tsx:340-344`. Define latest-turn action ownership or explicit fresh revalidation. Do not silently allow stale hard constraints.
- Repeated `results-heading`, `web-research-heading`, and `handoff-heading` IDs become invalid with mounted history. Use message-specific IDs or generated IDs.
- Backend returns complete JSON. Pending UI may report the actual pending request. Recorded activity appears only after returned events. No fake streaming or reasoning. See `docs/frontend-standard.md:32-38`.
- Keep fixture labels on every claim, price, and stock state. Manufacturer references provide context only. Optional web excerpts do not prove sample facts, offers, or inventory. Keep exact catalog handoff validation and React text escaping.

## Browser assertions to retain

`tests/e2e/research-shopping.spec.ts` covers real fixture journey and safe handoff `71-104`; priority hard-object preservation `106-130`; invalid/lower budgets `150-172`; priority/region/length/no-cap adaptation `174-203`; ambiguity/category/unsupported hard requirements `205-240`; independent contexts/reset `243-258`; late turn `261-281`; four malicious successful handoffs `284-320`; pending selection interrupted by typing/reset `323-356`; network retry preserving input `359-370`; mobile editor keyboard access `373-401`; evidence/comparison keyboard/touch `404-430`; truthful activity and malformed metadata `433-479`; explicit source action/StrictMode `482-502`; text escaping/unsafe source URLs `504-539`; explicit retry/double-click `561-585`; source cancellation `587-634`; responsive sources and compact disclosure `637-724`.

History requires message-scoped selectors because global first card, repeated headings, single source-panel counts, and global alerts no longer identify the active turn. Keep the behavioral/security assertions. Change stale-result tests to assert the newest turn remains authoritative while completed prior messages remain attributable. Reset must clear all history and active work. If Sheet becomes inline disclosure, test the actual new semantics, single editor, focus, and mobile readability.

New frontend acceptance needs desktop/mobile viewport screenshots of dark initial state, at least two retained turns, visible bottom composer, older-history scrolling, open/collapsed preferences, evidence, and handoff. Full-page screenshots alone do not prove composer visibility or scroll behavior.

## Verification-owner changes

- `.agents/skills/verify-research-shopping/scripts/smoke.mjs:48` omits `EXA_RESEARCH_ENABLED=false`; readiness at `64-66` omits `webResearch === "disabled"`. Fix both. `SKILL.md:18,24` already claims both checks. `npm run verify:offline` disables Exa but documented direct helper execution does not.
- Preserve fresh-port ownership, checkout/commit/dirty-state recording, traces, unexpected external-request check, API/handoff equality, and process-group cleanup.
- Update workspace handle at helper `85`, active-result/editor handles `101-110`, and selection handles `119-124`. Open collapsed preferences before reading editor values.
- Add actual follow-up history proof and viewport screenshots. Keep full-page artifacts as supplementary evidence.
- Align skill feature files for preferences, recovery, research, selection, and web context. They currently say edits remove shortlist and handoff removes source panel. Define cancellation/current eligibility separately from retained history.
- `playwright.config.ts` already disables Exa in owned servers and refuses reuse. Package scripts also disable live composition. Preserve those settings.

## Existing rationale and unresolved questions

`docs/architecture.md:11-17` explains separate hard limits, flexible ranking, evidence, offers, and response kinds. `docs/capability-gaps.md:36` requires constraints to remain visible/editable. The sidebar exposes that model, but no inspected document requires a permanent sidebar. `docs/architecture.md:7,43-45` explains the bounded functional pipeline and temporary local state. It does not require erasing visual message history. `docs/frontend-standard.md:26-38` explicitly preserves drafts, cancellation, safe selection, concise results, and progressive disclosure.

Unresolved product choice is historical action ownership. Source establishes fresh eligibility and cancellation requirements but does not define whether old cards stay selectable. No visual reference was provided to this delegate. No runtime, CI, current website, or audit verdict is claimed here. No relevant memory entries contributed.

Files read include the source/configuration and documentation named above, the verification skill and feature map, the local provenance manifest, and installed pstack runtime, poteto-mode, persona, explorer-prompt, unslop, technical-writing, and Minimize Reader Load instructions. That principle shaped reuse of existing components and explicit action ownership instead of hidden global state in historical messages.
