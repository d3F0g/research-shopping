# V2 feature map

| Journey | Guide | Current implementation | Maintained package coverage |
| --- | --- | --- | --- |
| Chat, themes, scrolling, initial answer | [Chat](chat.md) | `src/client/App.tsx`, `theme-provider.tsx`, official message-scroller components | `tests/e2e/v2-chat.spec.ts` |
| Clarification and contextual edits | [Preferences](preferences.md) | `src/domain/turn-reducer.ts`, `src/client/PreferenceEditor.tsx` | `tests/unit/v2-conversation.test.ts`, `tests/api/v2-app.test.ts` |
| Prepare then research | [Research](research.md) | `src/server/conversations.ts`, `research-executor.ts`, `exa-research.ts` | `tests/api/v2-app.test.ts`, `tests/api/v2-exa.test.ts` |
| Assessments, prices, citations, images | [Evidence](evidence.md) | `src/domain/research.ts`, `src/client/ResearchAnswer.tsx` | `tests/api/v2-exa.test.ts`, browser suite |
| Safe product/source navigation | [Links](selection.md) | `src/domain/safe-url.ts`, `ResearchAnswer.tsx` | provider and API boundary tests |
| Cancellation, reset, sessions, optional accounts | [Session recovery](session-recovery.md) | `src/server/conversations.ts`, `app.ts`, `accounts.ts`, `workspace-store.ts` | API and conversation tests; inspect account scripts separately |
| Live provider and billing limits | [Live research boundaries](web-research.md) | `src/server/index.ts`, `research-quota.ts` | quota tests and local SDK transports |

The smoke helper exercises only its stated subset. There is no `/api/select`, synthetic runtime catalog, fixed category form, or optional web-context action in V2. Compare current paths and scripts before expanding a verification claim.
