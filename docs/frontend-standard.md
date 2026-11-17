# Official frontend foundation

The research workspace uses official shadcn/ui primitives and the current official AI Elements compositions. `AGENTS.md` makes this the required standard for future frontend work.

## Component provenance

The official shadcn CLI4.23.0 initialized the existing Vite application with `--preset nova --base base`. The resulting `components.json` identifies style `base-nova`, React client components, semantic CSS variables, Lucide icons, and matching `@/*` aliases in TypeScript and Vite.

Twenty-one official registry source snapshots and their SHA256 values are retained in [the provenance manifest](../artifacts/frontend-standard/provenance/registry-manifest.json). The snapshots use `https://ui.shadcn.com/r/styles/base-nova/`. Root verified every retained hash and corresponding generated component. CLI transformations resolve registry dependencies, icon placeholders, and project aliases. These are official generated components, not handmade substitutes.

The current documentation defines AI Elements as patterns composed from shadcn components. The implementation uses those patterns directly. No legacy AI SDK Elements package or model transport was added just for appearance.

| Interface | Official composition |
| --- | --- |
| Current user/assistant exchange | Message Scroller, Message, and Bubble |
| Prompt and submission | Input Group textarea and button |
| Product shortlist and handoff | Card, Badge, Button and documented semantic anchor variants |
| Editable constraints and preferences | Field, Input, Native Select, Checkbox and Separator |
| Mobile preferences | Sheet with focus trapping and return |
| Comparison | Collapsible and Table |
| Inline manufacturer context | Hover Card with a focusable citation trigger |
| Touch-accessible evidence and source states | Trace disclosure with safe links |
| Recorded provider outcomes | Tool pattern built on Trace |
| Clarification, failure, and empty results | Alert and Empty |

## Design and behavior

Semantic theme tokens define surfaces, foregrounds, borders, focus, status, and the restrained green accent. Local Geist provides consistent typography without a third-party font request. Functional copy uses14–16px type and metadata uses12px. Spacing, controls, overlays, and focus indicators share the same component foundation.

The current exchange preserves the existing preference drafts, hard constraints, revision checks, request cancellation, reset, and safe selection. Large decorative content was removed. After submission, examples collapse and the composer becomes compact so the answer appears earlier on mobile. Product cards expose a sample price, useful reasons, a tradeoff, source context, and selection. Detailed claims and comparison expand only when requested.

## Truthful AI-native presentation

The backend still returns complete JSON. There is no simulated token stream or invented reasoning. The official conversation components handle the present exchange and can support real streaming when transport exists.

`TurnResponseSchema` adds a bounded `toolActivity` array to the existing result union. Every event contains only an actual provider name and recorded outcome. The server snapshots events observed before responding. The UI does not invent durations, product identities, intermediate progress, or a complete execution audit. Clarifications can legitimately have no recorded provider outcomes.

Manufacturer references provide context for synthetic scenarios. They do not establish the truth of sample specifications, live price, inventory, shipping, or purchasable variants. Existing safe-host and exact-product identity checks remain at the boundaries.

## Runtime verification

Independent review of `804adae` passed110 unit/API tests,19 browser journeys, build/typecheck, the project helper, and desktop/mobile exploration. [The review](../artifacts/frontend-standard/independent/review.md) covers1440px and390px layouts, keyboard focus, Sheet trapping/return, touch references, comparisons, error/retry, safe handoff, actual activity metadata, and registry provenance.

The final application candidate `a3163a2` additionally exposes the starter's inferred Portability preference and patches the shadcn CLI dependency chain. Independent checks passed110 unit/API tests,20 browser journeys, typecheck/build, and zero-vulnerability full/production audits. [Final candidate proof](../artifacts/frontend-standard/final-delta/proof.json) records desktop/mobile priority editing while preserving the full hard-constraint object. [Original-checkout smoke proof](../artifacts/frontend-standard/integrated-smoke/proof.json) passed with owned-server cleanup; that run includes the documented working-tree state.

The dependency patch scopes minimatch11 to `@ts-morph/common`, retaining shadcn4.23.0 and the official component source. It addresses [GHSA-g3hv-75wg-m249](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249). Actual `shadcn info` and add-button dry-run checks pass. This override does not enter the application bundle.

[CI documentation](ci.md) records the active automatic PR workflow. The latest commit's hosted checks are the publication gate. PR20 remains unmerged.

Generated artifacts are excluded from the Vite watcher. Playwright trace HTML must not reload the application or reset a test's live UI state.

## Official references

- [shadcn/ui](https://ui.shadcn.com/docs)
- [Vite installation](https://ui.shadcn.com/docs/installation/vite)
- [AI Elements](https://ui.shadcn.com/docs/ai-elements)
- [Chat](https://ui.shadcn.com/docs/ai-elements/base/chat)
- [Prompt Input](https://ui.shadcn.com/docs/ai-elements/base/prompt-input)
- [Inline Citation](https://ui.shadcn.com/docs/ai-elements/base/inline-citation)
- [Sources](https://ui.shadcn.com/docs/ai-elements/base/sources)
- [Tool](https://ui.shadcn.com/docs/ai-elements/base/tool)
