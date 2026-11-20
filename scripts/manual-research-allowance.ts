import { parseArgs } from "node:util";
import { createResearchQuota } from "../src/server/research-quota";

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      ledger: { type: "string" },
      grant: { type: "string" },
      "grant-id": { type: "string" },
      "approval-reference": { type: "string" },
      "reviewed-commit": { type: "string" },
      "approved-at": { type: "string" },
      "expected-ledger-sha256": { type: "string" },
    },
  });
  const command = positionals[0];
  if (
    positionals.length !== 1 ||
    !["create", "inspect"].includes(command!) ||
    !values.ledger ||
    !values.grant
  )
    throw new Error(
      "Usage: manual-research-allowance.ts create|inspect --ledger ABSOLUTE_PATH --grant ABSOLUTE_PATH",
    );
  const quota = createResearchQuota(values.ledger, {
    manualGrantPath: values.grant,
  });
  const result =
    command === "create"
      ? await quota.createManualGrant({
          grantId: values["grant-id"]!,
          approvalReference: values["approval-reference"]!,
          reviewedCommit: values["reviewed-commit"]!,
          approvedAt: values["approved-at"]!,
          expectedLedgerSha256: values["expected-ledger-sha256"]!,
        })
      : await quota.inspect();
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (command === "inspect" && !result.eligible) process.exitCode = 2;
} catch {
  process.stderr.write(
    "Manual research allowance command failed. Check the command, development mode, approval fields, paths and ledger hash. No grant was replaced.\n",
  );
  process.exitCode = 1;
}
