# Dynamic browser behavior mapping

The dynamic responseVersion 3 app replaces the fixture shortlist and page-grammar UI. Captured source data under `tests/fixtures/research-corpus/` remains unchanged. Synthetic model responses are test-authored evidence and do not establish real shopping outcomes.

| Earlier browser assertion | Current evidence |
| --- | --- |
| Dark first visit, theme persistence, minimal empty state and focus | `dynamic-shopping.spec.ts` opens a minimal dark chat and persists both theme choices. |
| Category menus and category-indexed priority controls | Replaced by open product descriptions and stable criterion edits. Unknown nouns and criteria remain research context. There is no automatic clearing when product wording changes. |
| Budget question, custom amount and skip | Server-owned question and skip boundary in `dynamic-shopping.spec.ts`; native composition in `dynamic-transport.spec.ts`. Category-dependent presets were removed. |
| Invalid budget drafts and previous cap retention | Explicit edit test blocks the save request, retains previous snapshot and then removes cap and criterion by ID. |
| Priority ordering and local fixed-catalog ranking | Removed as obsolete implementation. The client renders authoritative source-based choice and assessments without ranking. |
| Natural budget changes, hard constraints and dissatisfaction | Normal SDK/Hono transport test preserves criterion and earlier result, blocks choice under lower cap, and asks what should change without another provider call. |
| Current fixture handoff and optional fixture web-context actions | Removed from normal UI. Legacy rendering is read-only. Exact fixture handoff URL, identity, cancellation and session safety remain API/domain assertions. The current browser asserts these actions are absent and source links match admitted identity evidence. |
| Historical sample actions disappear | Dynamic edit and history tests retain earlier response text and remove historical edit/compare actions. The frozen historical renderer has no action ownership. |
| Source quotations, currency, conditions, conflicts and unknown facts | Current comparison test and adverse assessment test. Native transport binds literal text through real SDK and Hono. Server API tests own admission rules. Old page-grammar counts and grammar-specific selectors are obsolete. |
| Unsafe sources, malformed activity and forged quotations | Current response boundary rejects unsafe source URL, forged retained passage and unknown response version before rendering actions. Current activity is a completed research receipt with no provider-authored activity metadata. |
| Cancel, stop, reset, retry and late result publication | Current transport cancellation test observes failed HTTP request and rejects late publication. After preparation, accepted intent survives Stop. Retry issues research directly with a new operation ID and does not reinterpret the original message. Before acknowledgement, preparation remains retryable. |
| Pending invalid hard updates | Actual Hono/SDK browser probes retain invalid currency across ordinary replies and refresh with no provider call. Explicit correction or discard resolves the pending change. |
| Independent browser contexts and reset | Current recovery and isolation test. No prior intent or turn is visible in a new context. |
| Desktop/mobile disclosures, keyboard, touch and composer | Current UI and normal SDK/Hono journeys capture 1440px, 390x844 and 390x600, keyboard disclosure and citation focus, touch, overflow and composer visibility. |
| Frozen old responses | `tests/unit/conversation.test.ts` checks current and frozen historical rendering independently. It does not parse historical bytes as current intent. |

Browser route-injection tests establish client behavior. The separate SDK/Hono tests exercise the normal composition with a fake key and loopback provider. Neither proves real Exa extraction, semantic accuracy, current merchant pricing, stock or destinations. Root owns bounded live acceptance and independent review.
