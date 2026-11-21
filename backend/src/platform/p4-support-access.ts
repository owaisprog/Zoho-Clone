import { type VerifiedSyntheticTenant } from "./p4-membership.js";
import { assertPositiveTime, assertVerifiedSyntheticTenant, P4_DEMO_USER, P4OperationsDeniedError } from "./p4-operations-guards.js";
import { authorizeSyntheticPlatformRead, type P4SyntheticPlatformPrincipal } from "./p4-platform-administration.js";

/** P4.24: consent-backed, time-bounded metadata-only access *preview*. */
export interface P4SyntheticSupportConsent {
  serverResolved: true;
  orgId: string;
  ownerUserId: string;
  supportUserId: string;
  consentActive: true;
  consentAtMs: number;
  expiresAtMs: number;
  scope: "tenant.metadata.read";
}
export function inspectSyntheticSupportAccess(
  owner: VerifiedSyntheticTenant,
  support: P4SyntheticPlatformPrincipal,
  consent: P4SyntheticSupportConsent,
  nowMs: number,
): Readonly<{ orgId: string; supportUserId: string; scope: "tenant.metadata.read"; tenantRecordsAccessible: false }> {
  assertPositiveTime(nowMs);
  assertVerifiedSyntheticTenant(owner);
  const p = authorizeSyntheticPlatformRead(support, nowMs);
  if (owner.role !== "OWNER" || !consent || consent.serverResolved !== true ||
      consent.orgId !== owner.orgId || consent.ownerUserId !== owner.userId ||
      !P4_DEMO_USER.test(consent.supportUserId) || consent.supportUserId !== p.actorId ||
      consent.supportUserId === consent.ownerUserId ||
      consent.consentActive !== true || consent.scope !== "tenant.metadata.read" ||
      !Number.isSafeInteger(consent.consentAtMs) || consent.consentAtMs > nowMs ||
      nowMs - consent.consentAtMs > 15 * 60_000 ||
      !Number.isSafeInteger(consent.expiresAtMs) || consent.expiresAtMs <= nowMs ||
      consent.expiresAtMs > consent.consentAtMs + 30 * 60_000) throw new P4OperationsDeniedError();
  return Object.freeze({
    orgId: owner.orgId, supportUserId: p.actorId,
    scope: "tenant.metadata.read" as const, tenantRecordsAccessible: false as const,
  });
}
