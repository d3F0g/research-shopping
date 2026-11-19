# Evidence follow-up archive map

## Restore the checkpoint support first

The five `checkpoint-support-XX.tar.gz` files losslessly wrap the earlier numbered checkpoint archives, exact raw logs, intermediate audit reports and superseded replay receipts. Their original repository-relative paths and SHA256 values are in `checkpoint-support-manifest.json`. Extract these five parts into an empty directory first. Then extract the restored checkpoint parts listed below into that same directory. Current final QA/security/cleanup reports, final replay receipt, screenshots and final owner/QA archives remain directly available in the repository.

This preserves raw whitespace in failing source examples and keeps the PR within GitHub's 3000-path review limit. The original unwrapped copies remain locally; they were only unstaged, not deleted or modified. The outer wrapper and every member were read back and verified. The inner checkpoint manifest and the reviewer's earlier integrity checks remain valid for their identical bytes.

The following archives preserve intermediate and rejected checkpoints. They do not approve the eventual evidence4 candidate. All members were read back and checked against the SHA256 manifest after packing. Original reviewer files remain unchanged in their owned worktrees.

Extract every numbered part of a named group into the same empty directory to recover its repository-relative paths. The QA support parts contain the review reports, owned harnesses and sibling logs. Per-candidate parts contain their raw fixtures, browser screenshots/traces and result files. No dependencies or symlinks are archived.

| Archive | Bytes | Members |
| --- | ---: | ---: |
| `qa-pre-v3-support-01.tar.gz` | 5653429 | 129 |
| `qa-pre-v3-support-02.tar.gz` | 23194622 | 40 |
| `qa-pre-v3-support-03.tar.gz` | 55919357 | 132 |
| `qa-pre-v3-support-04.tar.gz` | 8390182 | 14 |
| `qa-33fadc7-01.tar.gz` | 10961344 | 118 |
| `qa-33fadc7-02.tar.gz` | 28170528 | 47 |
| `qa-33fadc7-03.tar.gz` | 57227150 | 34 |
| `qa-33fadc7-04.tar.gz` | 12757602 | 11 |
| `qa-651ee11-01.tar.gz` | 12504929 | 99 |
| `qa-651ee11-02.tar.gz` | 16202438 | 32 |
| `qa-579ec53-01.tar.gz` | 18293023 | 89 |
| `qa-579ec53-02.tar.gz` | 23088606 | 89 |
| `qa-579ec53-03.tar.gz` | 12313387 | 20 |
| `qa-ccfb87c-01.tar.gz` | 5874673 | 94 |
| `security-v3-checkpoints-01.tar.gz` | 105651 | 80 |

The complete archive and member hashes are in `reviewer-v3-checkpoint-manifest.json`. Each archive is below GitHub's per-file limit. Two initially oversized generated packages were replaced by these verified parts; the source evidence was retained.

`owner-651-checkpoint.tar.gz` and `owner-33fadc7-checks.tar.gz` preserve earlier author runs. `owner-579ec53-checkpoint.tar.gz` preserves the first V3 author candidate. `owner-ccfb87c-checkpoint.tar.gz` preserves the rejected second candidate, including its actual evidence3 state and report. Their manifests are adjacent. Rejected checkpoints have genuine passing checks alongside subsequently discovered failures. None is current approval.

The root red/green logs and superseded synthetic probe receipts are preserved at their original paths inside the checkpoint-support parts. `root-v3-private-replay-proof.json` pins579; `root-v3-final-private-replay-proof.json` pins rejectedccfb. Those receipts prove only the stated pure projection outcomes, not the correctness of every attribution or fresh retrieval. They do not certify a qualifying exact-variant price.

Raw diagnostic captures, including shopping text and provider payloads, remain outside Git, artifacts and normal history in bounded private diagnostics. Public receipts expose a capture hash and derived outcomes only. Root made zero paid calls. The existing private ledger and grants are unchanged.

Final V4 author proof is preserved in the four `owner-v4-final-XX.tar.gz` parts and `owner-v4-final-manifest.json` (313 members, readback verified). It distinguishes exactfd1 package/browser/eval runs from8ea PostgreSQL/history and4cfa UI-skill proof bound to unchanged blobs. `security-v4-fd1f505.tar.gz` and its receipt preserve independent scoped PASS. `root-v4-fd1f505-private-replay-proof.json` is the final derived pure replay receipt. The three loose `v4-*.png` files expose the actual current card/context views for review. Final QA and decision-trail reports, current hosted CI and varied manual acceptance remain separate gates recorded on PR53.

Final independent QA code/visual PASS is in `.audit/fieldnote-v2/evidence-gap/qa-fd1f505.md`. The four `qa-v4-final-XX.tar.gz` parts and `qa-v4-final-manifest.json` preserve all331 referenced current/support members, with readback verification. The support set includes actual old V3 catalog history with its original868 variant price, preserved unchanged beside new V4 observations. Final security and cleanup/trail scope PASS do not satisfy the still-outstanding varied live usefulness gate. HostedCI/current landing status is recorded in PR53 receipts.

Issue56 adds `history-reload-issue56.tar.gz` and its manifest. Its controlled red fails before the browser account data arrives; the verifier fix validates that browser response and exact workspace before the unchanged five-second render assertion. Application code is unchanged. Exact original CI latency remains unproven. The report is `.audit/fieldnote-v2/evidence-gap/history-reload-issue56.md`.

Sanitized independent publication/CI/trail receipts are in `publication-review-receipts.tar.gz` and its manifest. Member paths name the exact reviewed checkpoints. These reports distinguish a sanitized current tree from still-reachable earlier history, and code/visual passes from outstanding varied live acceptance. No raw identifying scan needles are included.

The subsequent initial-history CI failure is preserved in `history-initial-readiness.tar.gz` and its manifest. It contains author, independent QA/security and root red/green fixture receipts, with exact source commits and bounded browser response timelines. Both initial navigation and reload now validate their own successful account response before the original five-second assertions. All application/UI blobs remain unchanged. Original hosted latency, current-head CI, varied live usefulness and exposed-history remediation remain separate gates.

## Reviewed continuation at df32 and verifier 2b174712

The approved chat layout is retained. The continuation corrects the documented Exa Answer Draft7 dialect, keeps malformed responses rejected, moves free AI fit text into labeled evidence, and calls citation images source-page previews. Reset, Stop and bootstrap responses now retain ownership across newer messages and account transitions. Existing generation and submission counters keep their different meanings.

The current continuation manifest covers three archives. `history-initial-readiness.tar.gz` retains its original49 members and exact original archive/manifest, then adds schema, card and reset owner proof. `continuation-v4-proof-02.tar.gz` adds canonical late-response red/green proof, final independent QA/security, verifier63 controls and root probes. `history-reload-issue56.tar.gz` retains its original14 members and exact original archive/manifest, then adds diagnostic sensitivity, failed hosted artifacts and the complete four-attempt frozen34 protocol. All members have sizes and SHA256 values in the existing initial-readiness manifest. The adjacent history-reload manifest indexes the diagnostic archive.

The earlier loose post-trail document-binding JSON is preserved byte-for-byte as `preserved/post-trail-doc-binding.json` in the first archive. Current document hashes now live in the continuation manifest, avoiding a duplicate tracked binding file and keeping this PR below3000 changed paths. Restore `continuation/<owner>/artifacts/...` relative to its named checkout root; do not execute archived scripts without review.

Final application source is df32c4b3be6b09280369fc4eb38bf4e127312d41. The separate verifier correction is2b17471229a29e28f2ec0bc05211b3eff3b62466. The final QA/security reports retain exact commands and scope. Source tests passed456 unit/API,29 evaluation,28 PostgreSQL,24 browser tests,18 component comparisons, the three-viewport skill, actual account/history journeys and adversarial ownership probes. They do not establish live provider usefulness. Full60 remains INCONCLUSIVE.

The owner b373 late-response tree equals canonical df32 exactly. Canonical test-only71c9325 retains the old application hook; five expected failures and one paired control were actually run before the canonical fix. Supplementary verifier63 evidence distinguishes natural200 observation from a corrected pre-send interception control. A failed combined root Stop selector never reached its second SDK prerequisite; individual fresh-runtime selectors then passed. These limits and earlier failed setup/development attempts remain in the reports and logs.

Issue56's earlier blank page remains unexplained after four observed passing diagnostic attempts; no further repeats or fixed-cause claim is made. Issue62 retains a fail-closed signed-in409 recovery gap requiring explicit browser refresh. Draft preservation across that browser refresh is not claimed. The old malformed human response remains rejected in pure replay. Only sanitized outcomes and hashes are public; raw captures and their locators remain private. Current CI, live human acceptance and any shared-history authorization remain separate gates recorded on PR53.
