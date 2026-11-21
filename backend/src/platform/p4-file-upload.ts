import { type VerifiedSyntheticTenant, SYNTHETIC_ORG_ID } from "./p4-membership.js";
import { validatePrivateUploadCandidate } from "./storage-policy.js";
import { disabledStorage, type PrivateUploadRequest } from "./storage.js";

/**
 * P4.20 metadata-only validation and a fail-closed provider seam.
 * No live upload, signed URL, file contents, scan or download is enabled.
 * Do not mount POST /files/uploads or GET /files/:id before approved
 * private bucket, anti-malware/quarantine, Auth0 and record policy gates.
 */
export interface P4VerifiedSyntheticFileRecord {
  orgId: string;
  ownerUserId: string;
  recordType: "lead" | "task";
  recordId: string;
  canAttach: true;
}
export interface P4SyntheticFileMetadata {
  orgId: string;
  actorUserId: string;
  recordType: P4VerifiedSyntheticFileRecord["recordType"];
  recordId: string;
  name: string;
  mime: string;
  sizeBytes: number;
  sha256: string;
  status: "pending_provider_approval";
}
export class P4UploadDeniedError extends Error {
  constructor() { super("P4_UPLOAD_DENIED"); }
}
export class P4UploadNotConfiguredError extends Error {
  constructor() { super("P4_PRIVATE_STORAGE_NOT_CONFIGURED"); }
}
export function inspectP4SyntheticUpload(
  tenant: VerifiedSyntheticTenant,
  record: P4VerifiedSyntheticFileRecord,
  draft: PrivateUploadRequest,
): Readonly<P4SyntheticFileMetadata> {
  if (!tenant || tenant.verified !== true || !SYNTHETIC_ORG_ID.test(tenant.orgId) ||
      !/^user_demo_[a-z]{2,16}$/.test(tenant.userId) ||
      !record || record.canAttach !== true ||
      record.orgId !== tenant.orgId || record.ownerUserId !== tenant.userId ||
      (record.recordType !== "lead" && record.recordType !== "task") ||
      !/^(?:LEAD-DEMO-[0-9]{2,6}|TASK-DEMO-[0-9]{2,6})$/.test(record.recordId)) {
    throw new P4UploadDeniedError();
  }
  try {
    const file = validatePrivateUploadCandidate({
      organizationId: tenant.orgId, actorId: tenant.userId,
      recordType: record.recordType, recordId: record.recordId,
      permissionVerified: true,
    }, draft);
    return Object.freeze({
      orgId: tenant.orgId, actorUserId: tenant.userId,
      recordType: record.recordType, recordId: record.recordId,
      ...file, status: "pending_provider_approval" as const,
    });
  } catch { throw new P4UploadDeniedError(); }
}

/**
 * Even a valid candidate cannot get an upload grant until the owner
 * approves private storage + safe upload quarantining and scanning.
 * The intentionally disabled storage adapter is always used.
 */
export async function prepareP4SyntheticUpload(
  tenant: VerifiedSyntheticTenant,
  record: P4VerifiedSyntheticFileRecord,
  draft: PrivateUploadRequest,
): Promise<never> {
  const candidate = inspectP4SyntheticUpload(tenant, record, draft);
  try {
    await disabledStorage().prepareUpload({
      organizationId: candidate.orgId, actorId: candidate.actorUserId,
      recordType: candidate.recordType, recordId: candidate.recordId,
      permissionVerified: true,
    }, draft);
  } catch {
    throw new P4UploadNotConfiguredError();
  }
  throw new P4UploadNotConfiguredError();
}
export function requireP4ScannedPrivateFile(
  tenant: VerifiedSyntheticTenant,
  file: { orgId: string; ownerUserId: string; scanStatus: string },
): never {
  // A clean scan alone must not grant download: app module record rights
  // and an authenticated private provider must both be present.
  void tenant; void file;
  throw new P4UploadNotConfiguredError();
}
