# Proposal revision v2

The public request asks for a flashing receiver the user's mother can carry because she misses the doorbell while in the garden. Carryability is part of the requested functional solution. The wording does not present it as optional. I agree with the public-only review finding and changed this one criterion from flexible to hard.

The change is at conversations[2].turns[0].proposal.actions[3].strength, case FN-CU-003. The exact source remains "she can carry", with UTF-16 start 87 and end 100. No other field changed. The v1 artifact remains byte-for-byte unchanged. Both versions contain 60 conversations and 140 turns. All spans and symbolic targets are preserved.

The v1 SHA-256 is `17525bfaf31fd65bd124a1d18050e98cbb9a6d622bc68aab6e9252287db0d0c3`.

The v2 SHA-256 is `ba136b479052387d0ab913a7bb4d802eebe4f7e17be79846d908e5fd87c4044a`.

The author inspected only the permitted public conversation and existing proposal artifact for this revision. input-quality-review.md was not present. No application output, private expectation, oracle, application run, paid call, credential, ledger, or GitHub operation informed this correction. The parent's integration gate remains in effect.

Prove It Works required a byte comparison of v1, a deep structural comparison with only this leaf restored, and a one-line unified diff check. This revision changes synthetic provider input. It does not establish model understanding or application correctness.

```diff
--- intent-proposals.json
+++ intent-proposals.v2.json
@@ -192,7 +192,7 @@
                   "end": 100,
                   "text": "she can carry"
                 },
-                "strength": "flexible"
+                "strength": "hard"
               }
             ]
           },
```
