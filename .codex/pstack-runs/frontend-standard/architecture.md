# Official frontend migration

The audit found an821-line custom App, bespoke control/card/disclosure styles, no shadcn registry setup, no compact comparison surface, and JSON-only responses. Current official AI Elements are compositions of shadcn/ui, not the legacy AI SDK Elements package.

## Chosen structure

Use a current request/result exchange composed with official Message Scroller, Message, and Bubble patterns. Preserve the existing revision, cancellation, preference draft, reset, and selection guards. Full transcript history was rejected because it introduces obsolete recommendation and selection semantics outside this migration.

Use one coherent Base UI base-nova preset and current official CLI. The frontend owner reports CLI4.23.0. Record generated component and pattern provenance after implementation. Configure @/* to src/client/* consistently in TypeScript, Vite, and components.json.

Use shadcn Cards, Table, Collapsible, Field, Input, Native Select, Checkbox, Alert, and Sheet for the shopping workspace. Official Prompt Input uses Input Group. Inline Citation uses Hover Card, with touch-accessible references. Official Tool/Sources patterns use Trace. Omit unsupported attachments, model pickers, and fabricated reasoning.

## Honest activity contract

The engine already records request-local provider outcomes. Preserve core TurnResult and expose TurnResponseSchema as its intersection with required toolActivity, bounded to20 events. An event carries only provider and outcome. Clarifications have no events. The response snapshots observed events, not a complete audit of calls still settling after a failure. No SSE or token simulation is introduced. Pending UI represents an actual outstanding request.

## Sources

- https://ui.shadcn.com/docs
- https://ui.shadcn.com/docs/installation/vite
- https://ui.shadcn.com/docs/ai-elements
- https://ui.shadcn.com/docs/ai-elements/base/chat
- https://ui.shadcn.com/docs/ai-elements/base/message
- https://ui.shadcn.com/docs/ai-elements/base/prompt-input
- https://ui.shadcn.com/docs/ai-elements/base/inline-citation
- https://ui.shadcn.com/docs/ai-elements/base/sources
- https://ui.shadcn.com/docs/ai-elements/base/tool
