import { randomUUID } from "node:crypto";

/**
 * Architecture v1.0 / ADR 0007: canonical UUIDv4 internal IDs for NEW
 * entities. Auth0 external \`issuer+sub\` remains an identity-provider string;
 * legacy user_demo_* CI fixtures are NOT production user identifiers.
 *
 * Contract only: no schema migration, provider provisioning, or public API.
 */
const CANONICAL_UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export type P4UuidV4 = string & { readonly __p4UuidV4: unique symbol };

export class P4ApprovedKeyDeniedError extends Error {
  constructor() { super("P4_APPROVED_KEY_DENIED"); }
}
export function isCanonicalUuidV4(value: unknown): value is P4UuidV4 {
  return typeof value === "string" && CANONICAL_UUID_V4.test(value);
}
export function requireCanonicalUuidV4(value: unknown): P4UuidV4 {
  if (!isCanonicalUuidV4(value)) throw new P4ApprovedKeyDeniedError();
  return value;
}
/** Generate server-side only; never use a user-controlled UUID as authorization. */
export function newInternalUuidV4(): P4UuidV4 {
  return requireCanonicalUuidV4(randomUUID());
}
export interface P4ApprovedTenantKey {
  organizationId: P4UuidV4;
  recordId: P4UuidV4;
}
export function requireTenantRecordKey(
  organizationId: unknown, recordId: unknown,
): Readonly<P4ApprovedTenantKey> {
  return Object.freeze({
    organizationId: requireCanonicalUuidV4(organizationId),
    recordId: requireCanonicalUuidV4(recordId),
  });
}
/** Identity is not an organization or authorization grant. */
export function validateAuth0SubjectReference(
  ref: unknown,
): Readonly<{ issuer: string; subject: string }> {
  if (!ref || typeof ref !== "object" || Array.isArray(ref)) throw new P4ApprovedKeyDeniedError();
  const r = ref as Record<string, unknown>;
  // Only allow provider-issued subject from the verified server-side SDK.
  if (typeof r.issuer !== "string" || !/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.auth0\.com\/$/i.test(r.issuer) ||
      typeof r.subject !== "string" || !/^[A-Za-z0-9|:_-]{3,200}$/.test(r.subject)) {
    throw new P4ApprovedKeyDeniedError();
  }
  return Object.freeze({ issuer: r.issuer, subject: r.subject });
}
