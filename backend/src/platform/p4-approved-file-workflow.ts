import {
  isCanonicalUuidV4, requireCanonicalUuidV4,
  type P4UuidV4,
} from "./p4-approved-uuid.js";

/**
 * ADR 0007 P4.20/21: synthetic POLICY PLAN, NOT an execution adapter.
 * No writes, signed URLs, upload bytes, object keys or provider calls.
 * The eventual real implementation must independently verify Auth0 +
 * fresh active membership + RBAC/ABAC + DB RLS, and scanner attestation.
 */
export type P4ProposedFileState =
  "quarantined" | "scan_clean" | "rejected" | "soft_deleted";
export type P4ProposedFileAction =
  "scan_passed" | "scan_failed" | "soft_delete";
export interface P4ProposedFileMetadata {
  organizationId: string;
  fileId: string;
  recordId: string;
  ownerUserId: string;
  revision: number;
  state: P4ProposedFileState;
  quarantined: boolean;
}
export interface P4ProposedFilePolicyEvidence {
  serverResolved: true; // Not a browser permission token; trusted adapter only
  organizationId: string;
  actorId: string;
  currentMembershipVerified: true;
  canManageRecord: true;
  serverScannerAttested: boolean;
}
export interface P4FilePolicyPlan {
  organizationId: P4UuidV4;
  fileId: P4UuidV4;
  expectedRevision: number;
  nextRevision: number;
  nextState: P4ProposedFileState;
  uploadEnabled: false;
  downloadEnabled: false;
  deleteEnabled: false;
  persistEnabled: false;
}
export class P4FilePlanDeniedError extends Error {
  constructor() { super("P4_FILE_PLAN_DENIED"); }
}
const MAX_REVISION = 2_147_483_646;
function denied(): never { throw new P4FilePlanDeniedError(); }
export function planP4SyntheticFileTransition(
  file: P4ProposedFileMetadata,
  evidence: P4ProposedFilePolicyEvidence,
  action: P4ProposedFileAction,
  expectedRevision: number,
): Readonly<P4FilePolicyPlan> {
  if (!file || !evidence ||
      !isCanonicalUuidV4(file.organizationId) ||
      !isCanonicalUuidV4(file.fileId) ||
      !isCanonicalUuidV4(file.recordId) ||
      !isCanonicalUuidV4(file.ownerUserId) ||
      evidence.serverResolved !== true ||
      evidence.currentMembershipVerified !== true ||
      evidence.canManageRecord !== true ||
      !isCanonicalUuidV4(evidence.organizationId) ||
      !isCanonicalUuidV4(evidence.actorId) ||
      evidence.organizationId !== file.organizationId ||
      evidence.actorId !== file.ownerUserId ||
      !Number.isSafeInteger(file.revision) || file.revision < 1 ||
      file.revision > MAX_REVISION ||
      expectedRevision !== file.revision || typeof file.quarantined !== "boolean" ||
      !["quarantined","scan_clean","rejected","soft_deleted"].includes(file.state)) denied();

  let nextState: P4ProposedFileState;
  if (action === "scan_passed" && file.state === "quarantined" &&
      file.quarantined === true && evidence.serverScannerAttested === true) {
    nextState = "scan_clean";
  } else if (action === "scan_failed" && file.state === "quarantined" &&
      file.quarantined === true && evidence.serverScannerAttested === true) {
    nextState = "rejected";
  } else if (action === "soft_delete" &&
      (file.state === "scan_clean" || file.state === "rejected")) {
    nextState = "soft_deleted";
  } else denied();

  return Object.freeze({
    organizationId: requireCanonicalUuidV4(file.organizationId),
    fileId: requireCanonicalUuidV4(file.fileId),
    expectedRevision, nextRevision: expectedRevision + 1, nextState,
    uploadEnabled: false as const, downloadEnabled: false as const,
    deleteEnabled: false as const, persistEnabled: false as const,
  });
}
