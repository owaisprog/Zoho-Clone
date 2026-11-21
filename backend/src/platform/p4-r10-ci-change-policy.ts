/**
 * P4 Batch 10: REVIEW-ONLY authorization for proposed team/role changes.
 * Uses approved P1.06 deny-by-default rules and ADR 0008's scopes.
 * This is a pure evaluator; it must NOT write, publish jobs, or mount HTTP.
 *
 * IMPORTANT: Owner signoff is still needed for exact delegation, API,
 * audit retention, concurrent writer credentials and live activation.
 */
import { isCanonicalUuidV4 } from "./p4-approved-uuid.js";
import { getP4R7ApprovedMatrixRow } from "./p4-r7-authorizer.js";

export const P4R10_CI_ROLE_TOGGLE_ALLOWLIST = Object.freeze([
  "SALES_REP","SALES_MANAGER",
] as const);
export type P4R10CiAllowedRole = typeof P4R10_CI_ROLE_TOGGLE_ALLOWLIST[number];
export type P4R10CiChangeKind = "role_grant" | "team_grant";
export type P4R10CiChange = Readonly<{
  requestId: string;
  organizationId: string;
  actorId: string;
  targetUserId: string;
  kind: P4R10CiChangeKind;
  targetRef: string;
  expectedActive: boolean;
  nextActive: boolean;
  expectedRevision: number;
}>;
export type P4R10CiSnapshot = Readonly<{
  serverResolved: true;
  verifiedIdentity: true;
  activeOrganization: true;
  actorActiveMembership: true;
  targetActiveMembership: true;
  organizationId: string;
  actorId: string;
  targetUserId: string;
  actorRoles: readonly string[];
  targetRoles: readonly string[];
  /** Current DB row revision and state from a transaction with row lock. */
  currentRevision: number;
  currentActive: boolean;
  /** A team must be currently linked to this target within the same org. */
  currentTargetTeam?: Readonly<{
    organizationId: string;
    teamId: string;
    userId: string;
    managed: boolean;
  }>;
  /** DB counts, never client-provided. */
  activeOwnerCount: number;
}>;
export type P4R10CiReview = Readonly<{
  status: "denied" | "proposed" | "conflict";
  reason: "denied" | "proposed" | "conflict";
  audit?: Readonly<{
    organizationId: string;
    actorId: string;
    targetUserId: string;
    kind: P4R10CiChangeKind;
    targetRef: string;
    requestId: string;
    beforeActive: boolean;
    afterActive: boolean;
    expectedRevision: number;
  }>;
}>;
const DENIED:P4R10CiReview=Object.freeze({status:"denied",reason:"denied"});
const CONFLICT:P4R10CiReview=Object.freeze({status:"conflict",reason:"conflict"});
const ROLE_SET:ReadonlySet<string>=new Set(P4R10_CI_ROLE_TOGGLE_ALLOWLIST);
const ROLES_WITH_HARD_DENIAL:ReadonlySet<string>=new Set([
  "ORG_OWNER","ORG_ADMIN","PLATFORM_SUPPORT","SECURITY_REVIEWER",
  "EXTERNAL_AGENT","EXTERNAL_MERCHANT","SYSTEM_WORKER",
]);
function validRevision(x:unknown):x is number {
  return typeof x==="number"&&Number.isSafeInteger(x)&&x>=0&&x<1_000_000_000;
}
function validRoles(x:unknown):x is readonly string[] {
  return Array.isArray(x)&&x.length>0&&x.length<=13&&
    x.every(r=>typeof r==="string"&&r.length<=40)&&
    new Set(x).size===x.length;
}
/**
 * REVIEW ONLY; does not execute or promise authority. The allowed result is
 * a proposal for a separately approved, transactionally locked command.
 */
export function reviewP4R10CiChange(
  command:P4R10CiChange | null,
  snapshot:P4R10CiSnapshot | null,
):P4R10CiReview {
  if (!command||!snapshot||
      snapshot.serverResolved!==true||snapshot.verifiedIdentity!==true||
      snapshot.activeOrganization!==true||
      snapshot.actorActiveMembership!==true||
      snapshot.targetActiveMembership!==true||
      !isCanonicalUuidV4(command.requestId)||
      !isCanonicalUuidV4(command.organizationId)||
      !isCanonicalUuidV4(command.actorId)||
      !isCanonicalUuidV4(command.targetUserId)||
      command.organizationId!==snapshot.organizationId||
      command.actorId!==snapshot.actorId||
      command.targetUserId!==snapshot.targetUserId||
      command.actorId===command.targetUserId||
      !validRoles(snapshot.actorRoles)||
      !validRoles(snapshot.targetRoles)||
      !snapshot.actorRoles.includes("ORG_OWNER")||
      !getP4R7ApprovedMatrixRow("ORG_OWNER","role_grants")?.actions.some(a=>a==="M")||
      !getP4R7ApprovedMatrixRow("ORG_OWNER","memberships")?.actions.some(a=>a==="M")||
      !validRevision(command.expectedRevision)||
      !validRevision(snapshot.currentRevision)||
      !Number.isSafeInteger(snapshot.activeOwnerCount)||
      snapshot.activeOwnerCount<1||
      typeof command.expectedActive!=="boolean"||
      typeof command.nextActive!=="boolean"||
      typeof snapshot.currentActive!=="boolean"||
      command.expectedActive===command.nextActive||
      (command.kind!=="role_grant"&&command.kind!=="team_grant")||
      typeof command.targetRef!=="string"||
      command.targetRef.length>90||
      snapshot.actorRoles.some(r=>ROLES_WITH_HARD_DENIAL.has(r)&&r!=="ORG_OWNER")||
      snapshot.targetRoles.some(r=>r==="SYSTEM_WORKER"||r==="PLATFORM_SUPPORT"||
        r==="EXTERNAL_AGENT"||r==="EXTERNAL_MERCHANT")
  ) return DENIED;

  // This CI rehearsal may toggle only a pre-existing business sales role.
  // Never promote/demote OWNER, ORG_ADMIN, SECURITY or PLATFORM roles.
  if (command.kind==="role_grant"&&!ROLE_SET.has(command.targetRef)) return DENIED;
  if (command.kind==="team_grant"&&
      (!isCanonicalUuidV4(command.targetRef)||
       !snapshot.currentTargetTeam||
       snapshot.currentTargetTeam.organizationId!==command.organizationId||
       snapshot.currentTargetTeam.userId!==command.targetUserId||
       snapshot.currentTargetTeam.teamId!==command.targetRef||
       snapshot.currentTargetTeam.managed!==false)) return DENIED;

  // A true last-owner transfer is a separate high-risk workflow, not this
  // preview. A conflicting/stale revision is not a successful audit event.
  if (command.expectedRevision!==snapshot.currentRevision||
      command.expectedActive!==snapshot.currentActive) return CONFLICT;

  return Object.freeze({
    status:"proposed" as const,reason:"proposed" as const,
    audit:Object.freeze({
      organizationId:command.organizationId,actorId:command.actorId,
      targetUserId:command.targetUserId,kind:command.kind,
      targetRef:command.targetRef,requestId:command.requestId,
      beforeActive:command.expectedActive,afterActive:command.nextActive,
      expectedRevision:command.expectedRevision,
    }),
  });
}
/** Last-owner safeguard is universal even when other policies allow a change. */
export function mayDeactivateOwnerMembership(
  activeOwnerCount:unknown, replacementIsVerifiedActiveOwner:unknown,
):false {
  // All owner membership deactivation / transfers require separate
  // owner-approved workflow; never infer approval from count alone.
  void activeOwnerCount;
  void replacementIsVerifiedActiveOwner;
  return false;
}
