/**
 * P3.12: provider-neutral PRIVATE storage contract, NOT a live implementation.
 * Backend APIs must resolve tenant, record and permission scopes before calling.
 * No provider credentials, object content or signed URLs may enter logs.
 */
export interface StorageRequestContext {
  organizationId: string;
  actorId: string;
  recordType: string;
  recordId: string;
  permissionVerified: true;
}
export interface PrivateUploadRequest {
  name: string;
  mime: string;
  sizeBytes: number;
  sha256: string;
}
export interface PrivateUploadGrant {
  objectId: string;
  uploadUrl: string;
  expiresAt: string;
  requiredHeaders: Readonly<Record<string, string>>;
}
export interface PrivateDownloadGrant {
  objectId: string;
  downloadUrl: string;
  expiresAt: string;
}
export interface PrivateObjectStorage {
  prepareUpload(ctx: StorageRequestContext, upload: PrivateUploadRequest): Promise<PrivateUploadGrant>;
  prepareDownload(ctx: StorageRequestContext, objectId: string): Promise<PrivateDownloadGrant>;
  deleteObject(ctx: StorageRequestContext, objectId: string): Promise<void>;
}
export class StorageNotConfiguredError extends Error {
  constructor() {
    super("Private storage is not configured");
    this.name = "StorageNotConfiguredError";
  }
}
/** Deny by default: never return a fabricated signed URL. */
export function disabledStorage(): PrivateObjectStorage {
  return {
    async prepareUpload(): Promise<never> { throw new StorageNotConfiguredError(); },
    async prepareDownload(): Promise<never> { throw new StorageNotConfiguredError(); },
    async deleteObject(): Promise<never> { throw new StorageNotConfiguredError(); },
  };
}
