import { randomUUID } from "node:crypto";
import { SYNTHETIC_ORG_ID, type VerifiedSyntheticTenant } from "./p4-membership.js";

/**
 * P4.19 provisional append-only audit contract. No arbitrary actor-supplied
 * before/after data: these fields are ALWAYS REDACTED. Never log a token,
 * address, payload or document. The eventual write adapter needs DB-level
 * INSERT-only service credentials, retention, backup and independent review.
 */
export type P4AuditAction =
  "membership.revoked" | "org.preferences.changed" |
  "app.grant.changed" | "team.created" | "file.upload.requested";
export interface P4AuditEvent {
  eventId: string;
  orgId: string;
  actorUserId: string;
  action: P4AuditAction;
  objectType: "membership" | "organization" | "application" | "team" | "file";
  objectId: string;
  before: "[REDACTED]";
  after: "[REDACTED]";
  createdAt: string;
}
export interface P4AuditRepository {
  append(event: Readonly<P4AuditEvent>): Promise<void>;
  listByOrg(orgId: string, limit: number): Promise<readonly P4AuditEvent[]>;
}
export class P4AuditDeniedError extends Error {
  constructor() { super("P4_AUDIT_DENIED"); }
}
const ACTIONS: Readonly<Record<P4AuditAction, P4AuditEvent["objectType"]>> = Object.freeze({
  "membership.revoked": "membership",
  "org.preferences.changed": "organization",
  "app.grant.changed": "application",
  "team.created": "team",
  "file.upload.requested": "file",
});
const ID_PATTERN = /^(?:user_demo_[a-z]{2,16}|team_demo_[a-z]{2,24}|demo-[a-z0-9-]{2,60}|[0-9a-f]{8}-[0-9a-f-]{27,36})$/i;
function validTenant(tenant: VerifiedSyntheticTenant): boolean {
  return tenant?.verified === true && SYNTHETIC_ORG_ID.test(tenant.orgId) &&
    /^user_demo_[a-z]{2,16}$/.test(tenant.userId);
}
export function createP4SyntheticAuditEvent(
  tenant: VerifiedSyntheticTenant, action: P4AuditAction, objectId: unknown,
  nowMs: number, idFactory: () => string = randomUUID,
): Readonly<P4AuditEvent> {
  if (!validTenant(tenant) || !(action in ACTIONS) ||
      typeof objectId !== "string" || !ID_PATTERN.test(objectId) ||
      !Number.isSafeInteger(nowMs) || nowMs <= 0 ||
      !SYNTHETIC_ORG_ID.test(idFactory())) throw new P4AuditDeniedError();
  return Object.freeze({
    eventId: idFactory(), orgId: tenant.orgId,
    actorUserId: tenant.userId, action, objectType: ACTIONS[action],
    objectId, before: "[REDACTED]" as const,
    after: "[REDACTED]" as const, createdAt: new Date(nowMs).toISOString(),
  });
}
/** Event shape validates server-written records before reading. */
function validEvent(event: P4AuditEvent, tenant: VerifiedSyntheticTenant): boolean {
  return !!event && SYNTHETIC_ORG_ID.test(event.eventId) &&
    event.orgId === tenant.orgId &&
    /^user_demo_[a-z]{2,16}$/.test(event.actorUserId) &&
    event.action in ACTIONS && ACTIONS[event.action] === event.objectType &&
    ID_PATTERN.test(event.objectId) &&
    event.before === "[REDACTED]" && event.after === "[REDACTED]" &&
    !Number.isNaN(Date.parse(event.createdAt));
}
export async function listP4SyntheticAuditEvents(
  tenant: VerifiedSyntheticTenant, repo: P4AuditRepository, limit = 50,
): Promise<readonly P4AuditEvent[]> {
  if (!validTenant(tenant) || tenant.role !== "OWNER" ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new P4AuditDeniedError();
  try {
    const events = await repo.listByOrg(tenant.orgId, limit);
    if (!Array.isArray(events) || events.length > limit ||
        events.some(event => !validEvent(event, tenant))) throw new P4AuditDeniedError();
    return Object.freeze(events.map(e => Object.freeze({ ...e })));
  } catch { throw new P4AuditDeniedError(); }
}
export async function appendP4SyntheticAuditEvent(
  tenant: VerifiedSyntheticTenant, action: P4AuditAction, objectId: string,
  repo: P4AuditRepository, nowMs: number,
): Promise<void> {
  // The caller's actual membership, permission and transaction must be
  // checked AGAIN by the future database adapter.
  const event = createP4SyntheticAuditEvent(tenant, action, objectId, nowMs);
  try { await repo.append(event); }
  catch { throw new P4AuditDeniedError(); }
}
