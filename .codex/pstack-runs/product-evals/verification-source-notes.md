# Verification maintenance source notes

Application source baseline bb51c38748b35d838b44109d72ab4dc9a9847d8c.

## Conversation and theme

Independent source reader found the current theme, anchored composer, retained-message and cancellation descriptions accurate. The missing-category quick-choice recipe is obsolete. Current UI has a structured optional budget question, not fixed-category quick choices. Source pointers are theme-provider.tsx:15, App.tsx:307, PreferenceQuestion.tsx:23 and useConversation.ts:139. Reader did not drive browser.

## Research requests

Independent source reader found legacy browser recipes unreachable through the current composer. Current useConversation sends v4 prepare/research, while test-fixture app validates legacy preferences. Current App does not render legacy recommendation responses or toolActivity. Source pointers are useConversation.ts:139, app.ts:22 and App.tsx:307. Root already observed the mismatch as HTTP400 in baseline smoke with cleanup true. Keep legacy API/domain regression and normal browser driving distinct.

Remaining feature source readers and serial live coverage will be recorded before maintenance verdict.

## Hard limits and preferences

Independent source reader confirms legacy classification, but current UI cannot drive those legacy fixture recipes. Normal editor owns open description, stable Required/Flexible criteria, both budget bounds, currency, market and answer length. Saving does not automatically research; Compare is explicit. Invalid draft Save remains enabled and raises an alert while accepted state stays unchanged. Source pointers are PreferencePanel.tsx:46, :230, useConversation.ts:325 and tests/e2e/budget-range.spec.ts:76. Browser recipe requires actual range retention, invalid draft recovery, explicit floor removal and comparison on desktop/mobile.

## Evidence and uncertainty

Independent source reader found current source evidence disclosure, assessment states and quotes implemented in LiveResearchResults.tsx:74, :97 and :426. Legacy evidence labels still exist in frozen renderer code but cannot be reached through the current fixture composer. Replace claims that smoke proves legacy conflict labels. Current browser recipe should drive labeled synthetic normal SDK evidence and inspect actual quotes and safe links on desktop/mobile.

## Product selection

Independent source reader proved normal POST /api/select returns HTTP409 with Verified merchant selection is unavailable. Current client has no /api/select caller or selection button; LiveResearchResults.tsx:457 offers View product source. Fixture API handoff tests remain at tests/api/app.test.ts:160 and tests/unit/shopping.test.ts:220. Browser merchant selection is verified-unreachable because the feature is explicitly unavailable. Do not manufacture a handoff journey. Current source navigation still needs actual link policy checks and UI proof.

## Session and recovery

Independent reader confirms reset, retry, sequence cancellation and independent theme state. Normal merchant handoff prerequisites are unreachable. Pending-change retention across refresh contradicts actual in-memory state initialization and the current UI's until-refresh disclosure. Keep the desired persistence gap explicit rather than converting source inspection into proof. Browser recipe covers two contexts, an intercepted failed ordinary reply, retry without duplicates, draft cancellation, New chat and refresh/theme behavior. SDK cancellation needs separate actual transport proof.

## Exa product research

Independent reader confirms preparation, one research admission, actual SDK abort signal and observed price qualifiers. Guide refers to removed tests/e2e/live-research.spec.ts; current dynamic suites provide distinct response-stub, routed Hono/SDK and actual HTTP/Hono/SDK coverage. Source pointers are research-turns.ts:36, exa-research.ts:590 and LiveResearchResults.tsx:270. Disclosure and held-evidence comparisons are distinct from submitting Compare options, which requests research. Live product usefulness requires separate authorized evidence and is not attempted by this run.

All seven existing feature files have independent source coverage. Root serial package browser run began after these returns, with explicit disabled Exa and retained traces. Legacy fixture browser selection is verified-unreachable; fixture domain/API coverage remains separate. Human calibration and genuine research are prerequisites outside offline driving.
