# Chat-first frontend standard

Fieldnote is a shopping conversation. The interface has a minimal header, centered message history and a compact composer at the bottom during conversations. First visits use dark mode. The theme toggle persists an explicit light or dark preference.

## Compose the conversation

Use the actual official shadcn/ui components and current AI Elements patterns. The installed Message Scroller, Message, Bubble and Input Group components already provide the chat foundation. Compose recommendation cards, comparisons, citations, evidence and recorded tool activity inside assistant messages.

Keep the empty chat quiet. Do not add a permanent filter sidebar, large preference form, introductory panel or empty-results placeholder. Ordinary acknowledgments remain ordinary text. Recommendations need concise reasons and useful tradeoffs, with evidence and comparisons behind disclosure controls.

Extract preferences from each message before asking a question. Keep accepted shopping preferences in structured session state. Ask for a missing material fact in a compact inline card, offer quick choices, and allow optional questions to be skipped. Do not ask for facts already provided. Users can change their preferences through follow-up messages or contextual editing controls.

Retain earlier user and assistant messages. A historical response records the preferences and results from that turn. Current constraints govern new research and selection. Invalidate stale pending work explicitly when history stays mounted. Do not rely on removing a message to cancel its requests.

## Official component provenance

The original shadcn CLI 4.23.0 setup uses the base-nova registry and Lucide icons. The source snapshots and SHA256 values remain in [the provenance manifest](../artifacts/frontend-standard/provenance/registry-manifest.json). Reuse these generated components. Fetch new components from the official registry rather than writing substitutes.

Current official documentation defines AI Elements as compositions of shadcn/ui components. A separate model or legacy AI SDK Elements package is unnecessary for this deterministic application. The [Chat pattern](https://ui.shadcn.com/docs/ai-elements/base/chat) composes Message Scroller, Message, Bubble and Input Group. The [Prompt Input pattern](https://ui.shadcn.com/docs/ai-elements/base/prompt-input) supplies the textarea and send action. Source previews follow [Inline Citation](https://ui.shadcn.com/docs/ai-elements/base/inline-citation), composed from the installed Hover Card and Button. Source and completed tool disclosures follow [Sources](https://ui.shadcn.com/docs/ai-elements/base/sources) and [Tool](https://ui.shadcn.com/docs/ai-elements/base/tool) on the installed Trace components. These official patterns were checked against the current documentation during the Exa-primary work.

Use the [official Vite theme-provider pattern](https://ui.shadcn.com/docs/dark-mode/vite), with dark as the application default. Keep theme tokens centralized. Use local Geist, readable functional type, consistent spacing, contrast and visible focus. Respect reduced motion. Mobile controls, disclosures and composer must remain usable while history scrolls.

## Preserve truthful behavior

The backend returns complete JSON. Show pending state only while actual work is pending. Do not simulate streaming tokens, reasoning or intermediate tool activity. Recorded provider outcomes appear only after the server returns them.

Normal development uses Exa research observations. Product cards show exact supporting quotations, observed and unverified price text, and explicit uncertainty. Source links do not establish stock, delivery or merchant authorization. Synthetic catalogs and exact manufacturer handoffs remain confined to automated fixture regression, where every sample price, claim and stock state keeps its fixture label.

Preserve budget drafts, accepted hard limits, unknown constraints, preference cleanup, safe exact-product handoff, cancellation and stale-response guards. Repeated messages need unique accessible IDs and message-scoped selectors. A successful historical response must not authorize an action under obsolete preferences.

## Verify the actual interface

Run the project [verification skill](../.agents/skills/verify-research-shopping/SKILL.md), behavioral tests and API/security tests. Inspect actual desktop and mobile screenshots. Required chat states include the first dark visit, minimal empty state, ordinary messages, inline preference cards, multi-turn changes, recommendations inside assistant messages, evidence, comparison, safe handoff and a usable bottom composer. Verify both themes after refresh and verify mobile scrolling.

Independent visual QA must judge the rendered layout against the chat-first brief. A test pass cannot approve the old dashboard composition. Preserve existing behavior and security assertions when adapting selectors.

The user approved the issue #30 design in PR #33. Its screenshot-review milestone is satisfied. Future routine frontend PRs merge autonomously after CI, independent visual QA, security verification and repository policies pass. Request human design approval only for a milestone the user explicitly designates. Production deployments and sensitive operations retain their separate approval requirements.

Historical frontend evidence is retained under artifacts/frontend-standard. Those runs describe older candidates and do not establish acceptance of this redesign. The inherited picomatch advisory remains tracked in [issue #27](https://github.com/d3F0g/research-shopping/issues/27). Earlier zero-audit records are historical results.
