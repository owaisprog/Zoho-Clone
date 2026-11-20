import { type VerifiedSyntheticTenant } from "./p4-membership.js";
import { assertVerifiedSyntheticTenant, P4_DEMO_FILE, P4_DEMO_USER, P4OperationsDeniedError } from "./p4-operations-guards.js";

/**
 * P4.21 preview contract; not a storage adapter.
 * Download links and real deletion remain disabled until P4.20 gates close.
 * The caller must load file+record policy from a fresh authorized DB transaction.
 */
export interface P4SyntheticFileAccess {
  serverResolved: true;
  fileId: string;
  orgId: string;
  ownerUserId: string;
  recordId: string;
  recordCanRead: true;
  recordCanDelete: true;
  scanState: "quarantined" | "scan_clean" | "rejected";
  lifecycle: "active" | "deleted";
  versionCount: number;
}
export interface P4FileAccessSummary {
  fileId: string;
  orgId: string;
  versionCount: number;
  canPreviewMetadata: true;
  privateStorageReady: false;
}
export function inspectSyntheticFileAccess(
  tenant: VerifiedSyntheticTenant,
  file: P4SyntheticFileAccess,
): Readonly<P4FileAccessSummary> {
  assertVerifiedSyntheticTenant(tenant);
  if (!file || file.serverResolved !== true || !P4_DEMO_FILE.test(file.fileId) ||
      file.orgId !== tenant.orgId || !P4_DEMO_USER.test(file.ownerUserId) ||
      file.ownerUserId !== tenant.userId || file.recordCanRead !== true ||
      file.recordCanDelete !== true || !/^(LEAD|TASK)-DEMO-[0-9]{2,6}$/.test(file.recordId) ||
      !["quarantined", "scan_clean", "rejected"].includes(file.scanState) ||
      file.lifecycle !== "active" || !Number.isSafeInteger(file.versionCount) ||
      file.versionCount < 1 || file.versionCount > 100) throw new P4OperationsDeniedError();
  return Object.freeze({
    fileId: file.fileId, orgId: tenant.orgId, versionCount: file.versionCount,
    canPreviewMetadata: true as const, privateStorageReady: false as const,
  });
}
/** Deliberately no URL, bytes or object key, including after a clean scan. */
export function requestSyntheticFileDownload(tenant: VerifiedSyntheticTenant, file: P4SyntheticFileAccess): never {
  inspectSyntheticFileAccess(tenant, file);
  if (file.scanState !== "scan_clean") throw new P4OperationsDeniedError();
  throw new P4OperationsDeniedError();
}
/** A non-mutating deletion intent; never performs a delete or restore. */
export function planSyntheticFileDeletion(
  tenant: VerifiedSyntheticTenant, file: P4SyntheticFileAccess,
): Readonly<{ fileId: string; state: "requires_private_provider_and_audit"; deletableNow: false }> {
  const allowed = inspectSyntheticFileAccess(tenant, file);
  return Object.freeze({
    fileId: allowed.fileId, state: "requires_private_provider_and_audit" as const,
    deletableNow: false as const,
  });
}
