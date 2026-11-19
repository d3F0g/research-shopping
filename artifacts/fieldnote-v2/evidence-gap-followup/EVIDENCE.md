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
