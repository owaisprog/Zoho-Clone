/**
 * P4.06-07 synthetic-only membership and workspace-switching contracts.
 * Identity is server verified, but the real Auth0-to-user bridge is NOT wired.
 * There are no new public API endpoints or real customer data.
 */
export type SyntheticMembershipRole = "OWNER" | "MEMBER";
export interface TrustedSyntheticMemberActor {
  userId: string;
  providerVerified: true;
  emailVerified: true;
}
export interface SyntheticMembership {
  orgId: string;
  orgSlug: string;
  orgName: string;
  userId: string;
  role: SyntheticMembershipRole;
  active: boolean;
}
export interface MembershipLookup {
  listForUser(userId: string): Promise<readonly SyntheticMembership[]>;
  findForUserInOrg(userId: string, orgId: string): Promise<SyntheticMembership | null>;
}
export interface VerifiedSyntheticTenant {
  orgId: string;
  orgSlug: string;
  userId: string;
  role: SyntheticMembershipRole;
  verified: true;
}

export class SyntheticMembershipDeniedError extends Error {
  constructor() { super("P4_MEMBERSHIP_DENIED"); }
}

export const SYNTHETIC_ORG_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requireTrustedSyntheticMember(actor: TrustedSyntheticMemberActor): void {
  if (!actor || actor.providerVerified !== true || actor.emailVerified !== true ||
      typeof actor.userId !== "string" ||
      !/^user_demo_[a-z]{2,16}$/.test(actor.userId)) {
    throw new SyntheticMembershipDeniedError();
  }
}

function isMembership(row: SyntheticMembership, userId: string, orgId?: string): boolean {
  return row && row.active === true && row.userId === userId &&
    SYNTHETIC_ORG_ID.test(row.orgId) &&
    (orgId === undefined || row.orgId === orgId) &&
    /^demo-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.orgSlug) &&
    /^Demo [A-Za-z0-9 &' -]{3,80}$/.test(row.orgName) &&
    (row.role === "OWNER" || row.role === "MEMBER");
}

export async function listActiveSyntheticMemberships(
  actor: TrustedSyntheticMemberActor,
  repository: MembershipLookup,
): Promise<readonly SyntheticMembership[]> {
  requireTrustedSyntheticMember(actor);
  try {
    const rows = await repository.listForUser(actor.userId);
    if (!Array.isArray(rows) || rows.length > 100) throw new SyntheticMembershipDeniedError();
    const ids = new Set<string>();
    const clean: SyntheticMembership[] = [];
    for (const row of rows) {
      if (!isMembership(row, actor.userId) && row?.active === true) {
        throw new SyntheticMembershipDeniedError();
      }
      if (!row?.active) continue;
      if (ids.has(row.orgId)) throw new SyntheticMembershipDeniedError();
      ids.add(row.orgId);
      clean.push(Object.freeze({
        orgId: row.orgId, orgSlug: row.orgSlug, orgName: row.orgName,
        userId: actor.userId, role: row.role, active: true,
      }));
    }
    return Object.freeze(clean);
  } catch {
    throw new SyntheticMembershipDeniedError();
  }
}

export async function resolveSyntheticTenantContext(
  actor: TrustedSyntheticMemberActor,
  requestedOrgId: unknown,
  repository: MembershipLookup,
): Promise<VerifiedSyntheticTenant> {
  requireTrustedSyntheticMember(actor);
  if (typeof requestedOrgId !== "string" || !SYNTHETIC_ORG_ID.test(requestedOrgId)) {
    throw new SyntheticMembershipDeniedError();
  }
  try {
    // Each call reloads the exact user+org membership; no cache, JWT role,
    // URL slug, or previous workspace choice is treated as a grant.
    const row = await repository.findForUserInOrg(actor.userId, requestedOrgId);
    if (!row || !isMembership(row, actor.userId, requestedOrgId)) throw new SyntheticMembershipDeniedError();
    return Object.freeze({
      orgId: row.orgId, orgSlug: row.orgSlug,
      userId: actor.userId, role: row.role, verified: true,
    });
  } catch {
    throw new SyntheticMembershipDeniedError();
  }
}
