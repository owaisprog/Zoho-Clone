import { type VerifiedSyntheticTenant } from "./p4-membership.js";
import { assertPositiveTime, assertVerifiedSyntheticTenant, P4OperationsDeniedError } from "./p4-operations-guards.js";

/**
 * P4.25: simulated closure/export readiness only.
 * Never queues, erases, exports or persists an organization.
 */
export interface P4SyntheticClosureChecks {
  serverResolved: true;
  orgId: string;
  hasUnpaidBilling: boolean;
  hasLegalHold: boolean;
  hasPendingFileScans: boolean;
  hasActiveSupportAccess: boolean;
  retentionDays: number;
  recoveryRunbookApproved: boolean;
  auditWriterApproved: boolean;
}
export type P4ClosureIntent = "export" | "closure";
export function planSyntheticOrganizationClosure(
  tenant: VerifiedSyntheticTenant,
  intent: P4ClosureIntent,
  checks: P4SyntheticClosureChecks,
  nowMs: number,
  stepUpAtMs: number,
): Readonly<{ orgId: string; intent: P4ClosureIntent; blockers: readonly string[]; status: "blocked" | "not_executable"; jobsCreated: 0 }> {
  assertVerifiedSyntheticTenant(tenant);
  assertPositiveTime(nowMs);
  if (tenant.role !== "OWNER" || (intent !== "closure" && intent !== "export") ||
      !Number.isSafeInteger(stepUpAtMs) || stepUpAtMs > nowMs ||
      nowMs - stepUpAtMs > 5 * 60_000 || !checks ||
      checks.serverResolved !== true || checks.orgId !== tenant.orgId ||
      !Number.isSafeInteger(checks.retentionDays) || checks.retentionDays < 30 ||
      checks.retentionDays > 365 ||
      [checks.hasUnpaidBilling, checks.hasLegalHold, checks.hasPendingFileScans,
        checks.hasActiveSupportAccess, checks.recoveryRunbookApproved,
        checks.auditWriterApproved].some(value => typeof value !== "boolean")) {
    throw new P4OperationsDeniedError();
  }
  const blockers: string[] = [];
  if (checks.hasUnpaidBilling) blockers.push("unpaid_billing");
  if (checks.hasLegalHold) blockers.push("legal_hold");
  if (checks.hasPendingFileScans) blockers.push("unscanned_files");
  if (checks.hasActiveSupportAccess) blockers.push("active_support_access");
  if (!checks.recoveryRunbookApproved) blockers.push("recovery_runbook_approval");
  if (!checks.auditWriterApproved) blockers.push("audit_writer_approval");
  return Object.freeze({
    orgId: tenant.orgId, intent, blockers: Object.freeze(blockers),
    status: blockers.length ? "blocked" as const : "not_executable" as const,
    jobsCreated: 0 as const,
  });
}
