# Application integration hold

On 19 November 2026 root read GitHub PR 38 and compared its current head fd9d13793342cdd7e37686b09ae6c9ffd88bb69f with the evaluation baseline bb51c38748b35d838b44109d72ab4dc9a9847d8c. The application advanced fourteen commits and remains open against main. No other branch or worktree was modified.

The current evaluation baseline is intentionally the unchanged application revision at the start of this assignment. It is not a measurement of fd9d137 or a claim that those defects remain in the latest implementation.

## Observed contract changes

The new application uses current intent/response/evidence version 5 while freezing v4 history. createResearchTurns now accepts interpretIntent; general shopping language returns intent-unavailable without it. Typed edits, known controls and pending answers can resolve locally. Pending questions have stable identities and draft state. Exa evidence can carry safe identity-bound source image metadata. The UI adds truthful preparation progress and representative image rendering.

These facts were read from Git objects for src/server/research-turns.ts and docs/conversational-intent.md at fd9d137. No live provider, credential or receipt ledger was accessed.

## Adapter work after application stabilization

After PR 38 lands, integrate its trunk source in this evaluation branch, preserve the original baseline and add a versioned current adapter. Inject local transports for both intent interpretation and Exa research where needed. Never load real provider credentials or receipt ledgers. Bind active question replies to actual returned identities, retain actual prepare/research events and update evidence/image validation to the current schema. Preserve cancellation, no duplicate paid operation and session isolation.

Fixed intent interpretations can test the reducer and transport, but they do not prove the model understood arbitrary language. Never derive those replies from private expected preferences and then count the result as intent-understanding success. Genuine held-out interpretation evidence or separately authorized bounded live execution is needed for that dimension. Keep such coverage blocked rather than manufacturing a score.

Retain all sixty independently authored expectations. Report newly passing, newly failing and incompatible measurements with exact source and evaluator revisions. Rerun full browser/evaluation and obtain independent exact-head QA/security after integration. Retarget PR 47 to trunk only after its parent lands. Do not merge or arm auto-merge before these gates pass.
