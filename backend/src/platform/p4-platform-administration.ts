import { assertPositiveTime, P4_DEMO_USER, P4OperationsDeniedError } from "./p4-operations-guards.js";

/**
 * P4.23: distinct trusted platform principal. Tenant OWNER is never
 * sufficient. No public /platform route is wired; live MFA is not proven.
 */
export interface P4SyntheticPlatformPrincipal {
  userId: string;
  issuerSubjectVerified: true;
  serverResolvedGrant: true;
  platformRole: "PLATFORM_ADMIN" | "PLATFORM_AUDITOR";
  grantExpiresAtMs: number;
  mfaVerifiedAtMs: number;
}
export function authorizeSyntheticPlatformRead(
  principal: P4SyntheticPlatformPrincipal | null, nowMs: number,
): Readonly<{ actorId: string; permission: "platform.metadata.read"; tenantDataAccess: false }> {
  assertPositiveTime(nowMs);
  if (!principal || !P4_DEMO_USER.test(principal.userId) ||
      principal.issuerSubjectVerified !== true || principal.serverResolvedGrant !== true ||
      (principal.platformRole !== "PLATFORM_ADMIN" && principal.platformRole !== "PLATFORM_AUDITOR") ||
      !Number.isSafeInteger(principal.grantExpiresAtMs) ||
      principal.grantExpiresAtMs <= nowMs ||
      !Number.isSafeInteger(principal.mfaVerifiedAtMs) ||
      principal.mfaVerifiedAtMs > nowMs ||
      nowMs - principal.mfaVerifiedAtMs > 10 * 60_000) throw new P4OperationsDeniedError();
  return Object.freeze({
    actorId: principal.userId, permission: "platform.metadata.read" as const,
    tenantDataAccess: false as const,
  });
}
export function authorizeSyntheticPlatformMutation(
  principal: P4SyntheticPlatformPrincipal | null, nowMs: number,
): never {
  // Never authorize a tenant-data or platform mutation in the demo.
  authorizeSyntheticPlatformRead(principal, nowMs);
  throw new P4OperationsDeniedError();
}
