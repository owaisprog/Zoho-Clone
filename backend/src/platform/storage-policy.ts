import type { PrivateUploadRequest, StorageRequestContext } from "./storage.js";

/**
 * P3.12 draft metadata checks, NOT membership authorization/malware proof.
 * Any real file API must verify active tenancy, record rights and bytes.
 */
export class StorageCandidateRejectedError extends Error {
  constructor() { super("PRIVATE_UPLOAD_CANDIDATE_REJECTED"); }
}
const MIME_ALLOWLIST = new Set(["application/pdf", "image/jpeg", "image/png", "text/plain"]);
export const MAX_CANDIDATE_FILE_BYTES = 10 * 1024 * 1024;

export function validatePrivateUploadCandidate(
  context: StorageRequestContext,
  input: PrivateUploadRequest,
): Readonly<PrivateUploadRequest> {
  if (context.permissionVerified !== true ||
      !/^[A-Za-z0-9_-]{8,96}$/.test(context.organizationId) ||
      !/^[A-Za-z0-9_-]{8,96}$/.test(context.actorId) ||
      !/^[A-Za-z0-9_-]{2,40}$/.test(context.recordType) ||
      !/^[A-Za-z0-9_-]{3,96}$/.test(context.recordId) ||
      typeof input.name !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._ -]{0,119}$/.test(input.name) ||
      input.name.includes("..") || input.name.endsWith(".") ||
      !MIME_ALLOWLIST.has(input.mime) ||
      !Number.isSafeInteger(input.sizeBytes) ||
      input.sizeBytes < 1 || input.sizeBytes > MAX_CANDIDATE_FILE_BYTES ||
      !/^[a-f0-9]{64}$/i.test(input.sha256)) {
    throw new StorageCandidateRejectedError();
  }
  return Object.freeze({
    name: input.name,
    mime: input.mime,
    sizeBytes: input.sizeBytes,
    sha256: input.sha256.toLowerCase(),
  });
}
