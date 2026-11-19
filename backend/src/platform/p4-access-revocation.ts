import {
  requireTrustedSyntheticMember, SYNTHETIC_ORG_ID,
  type TrustedSyntheticMemberActor,
} from "./p4-membership.js";

/**
 * P4.14: atomic synthetic membership revocation. NO public DELETE route.
 * Changes should be visible immediately to any resolver that re-reads the
 * membership for every request. This does NOT revoke provider bearer JWTs:
 * a standalone Auth0 session/token revocation bridge is still unapproved.
 */
export class P4RevocationDeniedError extends Error {
  constructor() { super("P4_ACCESS_REVOCATION_DENIED"); }
}
export interface RevocationTx {
  membership(orgId: string, userId: string): Promise<{
    orgId: string; userId: string; active: boolean; role: "OWNER" | "MEMBER";
  } | null>;
  revokeMemberIfActive(orgId: string, userId: string): Promise<boolean>;
  /** Stored DB authorization revision, not an in-memory TTL-only cache. */
  incrementAuthorizationRevision(orgId: string, userId: string): Promise<void>;
  recordAudit(input: {
    orgId: string; actorUserId: string; targetUserId: string;
    action: "membership.revoked"; scope: "synthetic";
  }): Promise<void>;
}
export interface RevocationRepository {
  transaction<T>(operation: (tx: RevocationTx) => Promise<T>): Promise<T>;
}

export async function revokeSyntheticMembership(
  actor: TrustedSyntheticMemberActor,
  orgId: unknown,
  targetUserId: unknown,
  repository: RevocationRepository,
): Promise<{ revoked: true; orgId: string; targetUserId: string }> {
  try { requireTrustedSyntheticMember(actor); }
  catch { throw new P4RevocationDeniedError(); }
  if (typeof orgId !== "string" || !SYNTHETIC_ORG_ID.test(orgId) ||
      typeof targetUserId !== "string" ||
      !/^user_demo_[a-z]{2,16}$/.test(targetUserId) ||
      targetUserId === actor.userId) throw new P4RevocationDeniedError();

  try {
    return await repository.transaction(async tx => {
      const [manager, target] = await Promise.all([
        tx.membership(orgId, actor.userId),
        tx.membership(orgId, targetUserId),
      ]);
      if (!manager || manager.orgId !== orgId || manager.userId !== actor.userId ||
          manager.role !== "OWNER" || manager.active !== true ||
          !target || target.orgId !== orgId || target.userId !== targetUserId ||
          target.role !== "MEMBER" || target.active !== true) {
        throw new P4RevocationDeniedError();
      }
      if (!await tx.revokeMemberIfActive(orgId, targetUserId)) throw new P4RevocationDeniedError();
      await tx.incrementAuthorizationRevision(orgId, targetUserId);
      await tx.recordAudit({
        orgId, actorUserId: actor.userId, targetUserId,
        action: "membership.revoked", scope: "synthetic",
      });
      return { revoked: true, orgId, targetUserId };
    });
  } catch {
    // Do not expose DB errors or user existence to the response.
    throw new P4RevocationDeniedError();
  }
}
