import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { z } from "zod";

const { values } = parseArgs({ options: { authorization: { type: "string" }, "dry-run": { type: "boolean" } } });
if (!values.authorization) {
  console.error("Live evaluation blocked. No automated paid evaluation authorization was supplied. The existing manual-testing grant cannot authorize automated calls.");
  process.exitCode = 2;
} else {
  const Approval = z.object({ purpose: z.literal("automated-product-evaluation"), approvalReference: z.string().min(1), approvedAt: z.iso.datetime(), expiresAt: z.iso.datetime(), maximumRequests: z.number().int().min(1).max(10), maximumReservedUsd: z.number().positive().max(0.5), ledgerPath: z.string().min(1), acknowledgedLedgerSha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
  const approval = Approval.parse(JSON.parse(await readFile(values.authorization, "utf8")));
  if (Date.parse(approval.expiresAt) <= Date.now() || Date.parse(approval.approvedAt) > Date.now()) throw new Error("The supplied authorization is expired or not yet valid");
  console.log(JSON.stringify({ status: "blocked", mode: values["dry-run"] ? "authorization-preflight" : "live", reason: "Automated evaluation integration with the persistent stopped ledger has not been authorized and independently verified. No ledger was read or mutated, no attempt reserved and no provider contacted.", maximumRequests: approval.maximumRequests, maximumReservedUsd: approval.maximumReservedUsd, dispatched: 0 }));
  process.exitCode = 2;
}
