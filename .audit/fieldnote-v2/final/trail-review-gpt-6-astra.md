# Distinct-model decision-trail review

reviewed by gpt-6-astra

Scope: read-only, handoff-critical review of `research-shopping-v2` at `43bafcf9e3d113a2a0ccc01c9baf7377def6d3ef`, plus the pending delivery docs/evidence and decision log through the architecture correction at 2026-11-19T08:05:45Z. No application edits, new runtime acceptance claim, GitHub mutation, provider call, ledger access or unrelated-session scan occurred.

The only transcript read was `/Users/josiahwong/.codex/sessions/2026/11/19/rollout-2026-11-19T13-59-21-01a1f263-5f76-72c3-9542-35371b55ffc7.jsonl`. Its first session metadata confirms session `01a1f263-5f76-72c3-9542-35371b55ffc7` and original cwd `/Users/josiahwong/Documents/research-shopping`; its turn context identifies the working root model as `gpt-6.1-sol`. The distinct-review spawn is explicitly `gpt-6-astra`. I filtered messages/action metadata and inspected relevant source evidence; I did not dump image payloads or inspect other sessions.

## Evidence finding, corrected and independently rechecked

**The copied final reviews do not yet carry all their raw proof into the delivery.** Decision row 21 says “Archived complete final QA raw outputs,” and `docs/fieldnote-v2-delivery.md:46` describes a complete final QA raw archive. The 175-member archive actually contains `final-e0b/` and two helper scripts. It omits sibling command logs such as `artifacts/fieldnote-v2/qa/final-e0b-test.log` and `final-e0b-build.log`, cited by `.audit/fieldnote-v2/final/qa-e0b7317.md:35` and its table.

The copied security review also cites final `artifacts/fieldnote-v2/security/unit-api-tests-e0b7317.txt`, `context-http-e0b7317.json`, `account-context-e0b7317.json` and `cleanup.json` (`security-e0b7317.md:49`, `:75`, and Cleanup). None is present at those main-repository paths; the final context files are also absent from `security-reviews`. All six example files checked do exist in their respective reviewer worktrees. This is an evidence delivery gap, not evidence that the checks were invented.

Root corrected this before delivery in `reviewer-support.tar.gz` and `reviewer-support-manifest.json`, with an explicit extraction/path map in `EVIDENCE.md` and an append-only superseding decision at 2026-11-19T08:06:41Z. I independently verified all six cited missing examples are present at exact original archive paths, every one of the 216 member hashes and byte lengths matches its manifest, and the 494,874-byte archive SHA-256 is `8d3bd76897d7475b765f1601c93aaced456112c40fcad1413740d4545e3f152a`. This finding is resolved. No application rerun is required for copying existing verified bytes.

## Confirmed evidence and remaining gates

- The seven screenshot hashes and 38,956,810-byte QA archive hash match the manifest. Every pre-correction decision evidence path/object resolves using the repository or log directory. The run-identity and reviewer-identity entries are descriptive pointers rather than direct paths, but identify the exact permitted transcript and agent.
- `e0b7317:src` and `43bafcf:src` both equal `e1d7c10c59e1251216e3ba99c0a55c5157109fd9`. The complete non-evidence delta is the single Playwright configuration line. Both independent binding reports explicitly reuse prior runtime evidence and do not claim a new hosted run.
- The final evaluation raw report is pinned to `e0b7317`, reports 60 executed, 11 passed, 0 failed, 48 blocked, 1 unsupported, 140 turns, and zero critical/infrastructure failures. The bridge records 220 paired assessed requirements, 159 to 220 passing, and 60 unchanged inputs. The docs correctly refuse causal model-improvement or live-usefulness claims.
- The transcript shows root actually opened the final desktop/mobile/short-mobile images. The final QA and security reports state exact heads, commands, reused boundaries and limits. I found no major fabricated acceptance claim in this bounded review.
- The added corrections cover the initial same-model assignment, 598 deleted Git paths versus the original 590, first successful push at `7156349` versus later `015cebb`, run identity, and consequential atomic operation/presentation-revision design.
- **Final hosted CI is still a gate**, as decision rows 20/25 and the binding reports state. Local eight-test PR-like proof cannot close it. Record the final pushed head and actual required workflow outcomes before reporting the branch ready for final review. The delivery’s sentence that the final root comment “record[s]” outcomes is forward-looking until that receipt exists.
- **Product acceptance stays inconclusive.** Research usefulness and product relevance are unassessed across the sixty-case deterministic report; the small semantic sample has one useful and five uncertain application judgments with human calibration pending. Keep these limits prominent with the existing live Exa/#42 and merchant/#36 blockers. Final human appearance/evaluation review is explicitly required by the original V2 request; leaving PR #53 draft/unmerged is justified.

Verdict: the decision trail and handoff are broadly evidence-grounded within their stated offline scope. The raw-evidence packaging gap is resolved; complete the already-recorded final CI gate before handoff. No additional application blocker was identified by this bounded trail review.

## Attention

reviewed by gpt-6-astra

- Evidence packaging gap was found and corrected: all 216 support members independently verified; original paths resolve through `EVIDENCE.md`. No remaining flag on that correction.
- Verify hosted CI on the final pushed head; the metadata reproduction is local evidence only.
- Keep live product acceptance inconclusive: 48 blocked cases and unassessed relevance/usefulness remain, despite zero deterministic failures.
