import {
  InternalApiError, type InternalLead, type PreviewMembership,
  type VerifiedPreviewActor,
} from "./contracts.js";

/**
 * P3.14: no ORG_ADMIN/owner wildcard. Every action uses a current
 * membership read and a record-scoped query predicate.
 * This is a synthetic policy proof, not production authorization.
 */
export interface PreviewAuthorization {
  actor: VerifiedPreviewActor;
  membership: PreviewMembership;
  orgId: string;
  canEdit: boolean;
  canReadContact: boolean;
}
export function authorizePreview(
  actor: VerifiedPreviewActor | null,
  membership: PreviewMembership | undefined,
  orgId: string,
  action: "read" | "write",
): PreviewAuthorization {
  if (!actor || actor.verified !== true || !/^user_demo_[a-z]{2,16}$/.test(actor.userId)) {
    throw new InternalApiError(401, "UNAUTHORIZED");
  }
  // Privacy-preserving missing/other org reply; never trust an orgId by itself.
  if (!membership || !membership.active ||
      membership.orgId !== orgId || membership.userId !== actor.userId) {
    throw new InternalApiError(404, "NOT_FOUND");
  }
  const canEdit = membership.roles.includes("SALES_EDITOR");
  const canRead = canEdit || membership.roles.includes("SALES_READER");
  if (!canRead || (action === "write" && !canEdit)) {
    throw new InternalApiError(403, "FORBIDDEN");
  }
  return { actor, membership, orgId, canEdit, canReadContact: canEdit };
}
export function isLeadVisible(ctx: PreviewAuthorization, row: InternalLead): boolean {
  return row.orgId === ctx.orgId &&
    (ctx.membership.scope === "all" || row.ownerId === ctx.actor.userId);
}
export function visibleLeadPredicate(ctx: PreviewAuthorization) {
  // This predicate is deliberately pushed into the repository access call.
  // For real DB use a WHERE tenant_id + per-row ACL predicate in SQL.
  return (row: InternalLead) => isLeadVisible(ctx, row);
}