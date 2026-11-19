# Pinned explorer findings

Two independent read-only code explorers inspected fc06282a9921ab5b8608399a9b225b9c39023b8e. These are static findings, not runtime acceptance.

## Contracts, preferences, UI and history

The fixed category/feature/priority enums live in contracts.ts. preferences.ts combines per-category regex tables, fixed known brands/use cases and catalog.categoryFeatures; unknown remaining words become pending constraints. useConversation clones preference snapshots and also parses before send; server research-turns parses again. PreferencePanel, preference-options, PreferenceQuestion and App embed two-category options, indexed menus, budget presets and a headphones fallback. Normal API input and fresh output validate those same schemas. Dynamic criteria should preserve wording, hard/flexible status and stable identity; changing only CategorySchema cannot work.

Preserve request snapshots, separate current preferences from responses, cancellation/generation checks, quota reserve/call/settle order and inactive historical actions. Fixture catalog/shopping/providers/fixtures/test-fixture-app and offer/selection semantics remain automated-test only, not a live ranker.

Current research.ts and LiveResearchResults hold literal facts, price text and unresolved notes but cannot represent a comparative judgment or justified recommendation. research-turns.ts emits static answer text based on counts. Normal recommendations need an explicit bounded outcome.

PR41 published1b79732 adds frozen unversioned and v2 research codecs, but only research kinds have version dispatch. Other stored kinds, request snapshots, question snapshots and active workspace preferences still depend on mutable current PreferencesSchema/ApplicationTurnResponseSchema. Dynamic preferences without a new envelope would fail v2 restoration. Freeze every actual old stored kind/request/question shape, independently version fresh response/preferences and evidence, reject unknown versions without fallback, and migrate only active workspace preferences explicitly. Do not rewrite historical evidence or replay old request snapshots. Auth's unfinished integration worktree must remain intact; auth feature expansion is not this unit.

## Exa and evidence

Retrieval is working; application admission and missing answer generation are the bottleneck. exa-research.ts requests five-field native observations, then page-evidence.ts independently reparses identity, class, scope, feature, battery and price grammar. It permits unknown hard compliance as a lead. The 639-line engine is intrinsically headphone/laptop specific.

Actual checkpoint: music loses HN price because the native name omits Teal800073; laptop valid native results hit forbiddenIdentity's any-slash rejection (configuration slashes), MSI title/suffix equality mismatch, and ASUS missing known class words; commuting yields WH-CH720N with ANC/wireless/manufacturer compliance unknown. Source says Sold by partners.sony.com.sg, not an explicit manufacturer proof. Source snippets may be flattened/rewritten and cannot all be displayed as literal quotations.

Installed exa-js2.28.0 supports search(query,options,{signal,timeout}) returning results/output.content/output.grounding, and answer(query,options,{signal,timeout}) returning answer/citations/requestId/costDollars. Both use the same fetch/body-completion/abort/deadline transport. Answer options support text:true, systemPrompt, outputSchema and userLocation; no objective. Its citations TS type misses returned text, so parse unknown at boundary rather than cast. The app has no separate chat LLM, making answer a canonical skill-supported option. Search synthesis remains viable with stronger field grounding. Wide/deep shopping schemas exceed search's small-depth/property design; avoid another agent loop.

Normal shape can remove per-category class/device/feature/price grammars and static answer strings. Retain bounded schema validation, safe URLs, literal containment whenever presenting quotations, exact variant uncertainty, explicit unknown/conflict/violation eligibility, no fixture fallback, cost accounting and actual SDK abort.

Diagnostics currently understand search output.content/results[].highlights only; answer needs endpoint-aware shared capture shape while preserving dev-only absolute path,0600wx,128KiB allowlist/hash/truncation, no secrets/public history and sink-failure independence. Quota is endpoint-neutral: .05reservation,40attempts/2USDlocal exposure, one pending, unknown/error/overreservation stops work, no retry. Five settled actual calls report .035. None of the earlier proof allowances remain.

Canonical local skill and search/answer references have been read. Current official answer docs support structured output and returned citation text. Endpoint choice cannot prove semantic shopping quality; one tiny explicitly recorded dynamic-category live prototype should settle that risk before broad implementation. It is not normal-app acceptance.
