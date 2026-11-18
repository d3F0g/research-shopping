# Cancellation security review

The goal is to stop external shopping-provider work when a user cancels, without weakening deadlines, validation, or link safety.

Base `1cf12b2cb5468872365d825751dee532bc4f9d5a`.
Reviewed head `9a85ff1a04ac3bc2081c24785d854149a1116bdc`.
Worktree `/Users/josiahwong/Documents/research-shopping-cancellation`.
Application files were read only. The existing untracked `artifacts/cancellation-owner/` directory was preserved.

## Verdict

Security review passes for this exact cancellation patch. No blocking security findings were identified. This verdict does not resolve the separately tracked full-browser comparison overflow or replace independent QA and the required Comment Sicko pass.

## Findings and evidence

- Both mounted shopping routes pass the actual Hono request signal into the existing typed provider context. Validation, request-size limits, host/origin checks, source checks, and merchant-link checks are unchanged.
- The provider boundary checks pre-aborted callers before starting provider work. Its abort handler both rejects the waiting engine operation and aborts the provider controller. This cancels cooperative transport rather than only abandoning a promise.
- The boundary removes its caller listener, clears its deadline, and aborts its controller in `finally`. Provider success, failure, and timeout retain their previous outcomes. Caller cancellation does not publish a provider failure activity event.
- All outstanding parallel provider operations share the request signal through their own controllers. The mounted tests observe discovery cancellation on both routes, research and merchant cancellation on both routes, and an actual local HTTP response body closing before the provider deadline.
- `Promise.race` attaches rejection handlers to losing operations. A separate reviewer-authored local script ran 32 cancelled requests whose providers rejected afterward. There were no unhandled rejections, retained caller listeners, or late provider outcomes.
- A provider that ignores its signal can still perform external side effects. The patch settles the caller promptly and suppresses later activity, but cannot revoke a non-cooperative provider's independent work. The tested HTTP transport is cooperative. This is an integration contract, not a promise that arbitrary provider code is forcibly terminated.
- Cancellation still maps to the existing generic domain provider error for direct engine callers. A disconnected browser cannot receive that response, and existing client ownership guards suppress stale results. This patch introduces no raw error, abort reason, credential, or request-body logging.
- The diff contains no new comments, lint suppressions, TypeScript suppressions, dead compatibility paths, package changes, production deployment changes, credential changes, or permission changes. The named no-comments skill requires its own fresh Comment Sicko reviewer and remains root-owned.

## Commands

```sh
git rev-parse HEAD
git status --short
git diff 1cf12b2cb5468872365d825751dee532bc4f9d5a 9a85ff1a04ac3bc2081c24785d854149a1116bdc -- src/domain/shopping.ts src/server/app.ts tests/unit/shopping.test.ts tests/api/shopping-cancellation.test.ts
npm test -- tests/unit/shopping.test.ts tests/api/shopping-cancellation.test.ts
EXA_RESEARCH_ENABLED=false ./node_modules/.bin/tsx /tmp/research-shopping-live/cancellation-security/late-rejection.ts
git diff --check 1cf12b2cb5468872365d825751dee532bc4f9d5a HEAD
```

The two targeted files passed all 82 tests. The late-rejection script passed all 32 iterations. Diff whitespace checks passed. Logs are `targeted-tests.log` and `late-rejection.log` in this directory. No paid Exa calls, merchant requests, secrets reads, source edits, GitHub writes, or merges occurred.

## Principles that changed the review

Boundary Discipline kept the security inspection at incoming HTTP signals, provider execution, and outgoing provider data validation. Prove It Works required running the mounted transport tests and a fresh late-rejection experiment. Test Behavior, Not Implementation required evidence of upstream HTTP body closure and observable rejection handling, rather than trusting signal wiring alone.
