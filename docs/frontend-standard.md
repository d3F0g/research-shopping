# Fieldnote V2 frontend standard

Fieldnote is a centered shopping conversation with a minimal header and compact bottom composer. The first visit is dark. Explicit light or dark selection persists after refresh. Recommendations, contextual preferences and source evidence belong within the conversation. Ordinary replies remain ordinary messages.

## Official components

Generated shadcn source remains unmodified. The current CLI command, official registry/pattern URLs and eighteen file hashes are recorded in [registry-provenance.json](../src/client/components/registry-provenance.json). The base-nova registry and official neutral theme provide tokens and variants. CSS and caller classes cover layout and responsiveness.

The official [Chat composition](https://ui.shadcn.com/docs/ai-elements/base/chat) uses Message Scroller, Message, Bubble and Input Group. The [Prompt Input pattern](https://ui.shadcn.com/docs/ai-elements/base/prompt-input) provides the composer. Trace and its disclosure compositions show actual transport activity and expandable evidence. Hover Card and safe links provide source navigation.

Use standard Cards for useful recommendations and compact contextual controls. Keep alternatives and complete evidence behind disclosures. Do not restore the old dashboard, category/brand menus, permanent filters, large prechat form or decorative styling.

## Preserve actual behavior

The server owns accepted intent. A pending question retains its original request, identity and missing field separately from accepted preferences. The client sends messages or validated edits and renders authoritative results. Historical snapshots remain separate from current requirements and cannot revive abandoned research.

Transport is complete JSON rather than simulated token streaming. Show preparation and research only while actual operations are pending. The composer discloses that shopping submissions can trigger a paid Exa call. Held evidence and presentation changes spend nothing.

Source-based assessments, native excerpts, expanded context and merchant verification have different meanings. Display uncertainty and relevant adverse conditions prominently. Missing images remain absent. Citation images are attributed representative illustrations with exact-variant uncertainty. Test substitute products and prices remain visibly labeled.

## Verify rendered interaction

Use the [project verification skill](../.agents/skills/verify-research-shopping/SKILL.md), package browser journeys and independent visual QA. Inspect actual desktop, mobile and short-mobile viewport screenshots in both themes. DOM visibility alone cannot establish that the first useful answer is in view.

Issue #52 exposed estimated rich-message heights scrolling past the answer. The caller uses actual content layout and the documented message-scroller API while keeping generated source unchanged. Issue #40 also requires no overlap between the floating scroll action and source or preference controls. Verify rectangle intersections and actual hit targets, keyboard focus, touch, history scrolling and the bottom composer.

The user explicitly designated final V2 appearance/evaluation review. Leave the integration PR unmerged until that review. Earlier PR #33 approval applies to its historical milestone and does not waive this one. Older screenshots under `artifacts/frontend-standard/` remain historical evidence.
