# Evidence locations

Copied final reports preserve their original reviewer-relative paths and exact reviewed commits. Reviewer worktrees are not required to inspect the delivered final proof. Use the following mapping.

| Report reference | Delivered location |
| --- | --- |
| QA `artifacts/fieldnote-v2/qa/final-e0b/...` | `qa-e0b7317-raw.tar.gz`, member `final-e0b/...` |
| QA `artifacts/fieldnote-v2/qa/final-e0b-*.log` and other sibling logs | `reviewer-support.tar.gz`, exact original path |
| QA `.audit/fieldnote-v2/qa/...` helpers and prior review reports | `reviewer-support.tar.gz`, exact original path |
| Security `artifacts/fieldnote-v2/security/...` | `reviewer-support.tar.gz`, exact original path, including all retained red/green outputs, final unit/API logs, context HTTP/account evidence, dependency audit, cleanup and reviewed-code manifest |
| Security `.audit/fieldnote-v2/security/...` reproduction scripts/reviews | `reviewer-support.tar.gz`, exact original path |
| Readable selected current QA result, scorecard, semantic report and proofs | Adjacent prefixed JSON/Markdown copies |
| Earlier QA candidate outputs | Retained under the main checkout's `qa-interim/` and `qa-reviews/` audit/artifact folders; explicitly earlier candidate evidence, not rerun claims |
| Final metadata binding | Adjacent `qa-metadata-binding.json`, `security-metadata-binding.json`, and `.audit/fieldnote-v2/final/*43bafcf*` reports |

`manifest.json` binds the full final-e0b archive and screenshot copies. `reviewer-support-manifest.json` binds the support archive and every member byte-for-byte. Root read back and hashed each support archive member after creation. The archive contains local synthetic test credentials and fixture evidence only; it adds no real key, private environment file, usage ledger or provider account information.

To inspect without changing tracked evidence, extract into a fresh temporary directory:

```sh
proof_dir=$(mktemp -d)
tar -xzf artifacts/fieldnote-v2/delivery/qa-e0b7317-raw.tar.gz -C "$proof_dir"
tar -xzf artifacts/fieldnote-v2/delivery/reviewer-support.tar.gz -C "$proof_dir"
```

The first archive's `final-e0b/eval/` contains all sixty raw `FN-*.trace.json` files, complete report and summary. The final QA log family includes preserved failed harness diagnostics; those attempts are not counted as passing product proof. Semantic `private-manifest.json` is an evaluation label-to-case calibration map, not private user data or credentials.
