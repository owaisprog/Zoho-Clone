import { type VerifiedSyntheticTenant } from "./p4-membership.js";
import { assertVerifiedSyntheticTenant, P4_DEMO_USER, P4OperationsDeniedError } from "./p4-operations-guards.js";

/** P4.22 mock inbox contract: no email, worker, database writes, or live API. */
export type P4NoticeKind = "membership" | "task" | "system";
export type P4NoticeLink = "/app/organization/memberships" | "/app/tasks" | "/app/settings";
export interface P4SyntheticNotice {
  id: string;
  orgId: string;
  recipientUserId: string;
  kind: P4NoticeKind;
  link: P4NoticeLink;
  read: boolean;
}
export interface P4NoticeLookup {
  forRecipient(orgId: string, recipientUserId: string, limit: number): Promise<readonly P4SyntheticNotice[]>;
}
const allowedLinks: Record<P4NoticeKind, P4NoticeLink> = {
  membership: "/app/organization/memberships", task: "/app/tasks", system: "/app/settings",
};
function validNotice(row: P4SyntheticNotice, tenant: VerifiedSyntheticTenant): boolean {
  return !!row && /^notice_demo_[a-z0-9]{2,24}$/.test(row.id) &&
    row.orgId === tenant.orgId && row.recipientUserId === tenant.userId &&
    P4_DEMO_USER.test(row.recipientUserId) &&
    Object.prototype.hasOwnProperty.call(allowedLinks, row.kind) &&
    allowedLinks[row.kind] === row.link && typeof row.read === "boolean";
}
export async function listSyntheticNotifications(
  tenant: VerifiedSyntheticTenant, lookup: P4NoticeLookup, limit = 30,
): Promise<readonly Readonly<P4SyntheticNotice>[]> {
  assertVerifiedSyntheticTenant(tenant);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new P4OperationsDeniedError();
  try {
    const rows = await lookup.forRecipient(tenant.orgId, tenant.userId, limit);
    if (!Array.isArray(rows) || rows.length > limit || rows.some(row => !validNotice(row, tenant)) ||
        new Set(rows.map(row => row.id)).size !== rows.length) throw new P4OperationsDeniedError();
    return Object.freeze(rows.map(row => Object.freeze({ ...row })));
  } catch { throw new P4OperationsDeniedError(); }
}
export function previewSyntheticNotificationRead(
  tenant: VerifiedSyntheticTenant, notice: P4SyntheticNotice,
): Readonly<P4SyntheticNotice> {
  assertVerifiedSyntheticTenant(tenant);
  if (!validNotice(notice, tenant)) throw new P4OperationsDeniedError();
  // Browser preview only: the caller must never treat this as persisted state.
  return Object.freeze({ ...notice, read: true });
}
export function validateSyntheticNoticePreference(
  tenant: VerifiedSyntheticTenant, preference: { category: P4NoticeKind; inApp: boolean },
): Readonly<typeof preference> {
  assertVerifiedSyntheticTenant(tenant);
  if (!preference || !Object.prototype.hasOwnProperty.call(allowedLinks, preference.category) ||
      typeof preference.inApp !== "boolean") throw new P4OperationsDeniedError();
  return Object.freeze({ category: preference.category, inApp: preference.inApp });
}
