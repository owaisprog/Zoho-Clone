import {
  isCanonicalUuidV4, requireCanonicalUuidV4, type P4UuidV4,
} from "./p4-approved-uuid.js";

/**
 * ADR 0007 / P7 future transactional outbox contract.
 * Plans an inert, metadata-only domain event. No Redis/BullMQ publication,
 * database writes, third-party call or customer data.
 */
export type P4InternalEventName = "file.scan.requested" | "membership.revocation.requested";
export interface P4OutboxRequest {
  serverResolved: true;
  organizationId: string;
  actorId: string;
  resourceId: string;
  eventId: string;
  eventName: P4InternalEventName;
  idempotencyKey: string;
  aggregateRevision: number;
}
export interface P4OutboxPlan {
  eventId: P4UuidV4;
  organizationId: P4UuidV4;
  actorId: P4UuidV4;
  resourceId: P4UuidV4;
  name: P4InternalEventName;
  aggregateRevision: number;
  idempotencyKey: string;
  deliveryState: "not_scheduled";
  canPersist: false;
  canDispatch: false;
}
export class P4OutboxPlanDeniedError extends Error {
  constructor() { super("P4_OUTBOX_PLAN_DENIED"); }
}
export function planP4SyntheticOutboxEvent(req: P4OutboxRequest): Readonly<P4OutboxPlan> {
  if (!req || req.serverResolved !== true ||
      !isCanonicalUuidV4(req.organizationId) ||
      !isCanonicalUuidV4(req.actorId) ||
      !isCanonicalUuidV4(req.resourceId) ||
      !isCanonicalUuidV4(req.eventId) ||
      (req.eventName !== "file.scan.requested" &&
       req.eventName !== "membership.revocation.requested") ||
      typeof req.idempotencyKey !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/.test(req.idempotencyKey) ||
      !Number.isSafeInteger(req.aggregateRevision) ||
      req.aggregateRevision < 1 || req.aggregateRevision > 2_147_483_647) {
    throw new P4OutboxPlanDeniedError();
  }
  // Explicit safe output projection excludes arbitrary input fields.
  return Object.freeze({
    eventId: requireCanonicalUuidV4(req.eventId),
    organizationId: requireCanonicalUuidV4(req.organizationId),
    actorId: requireCanonicalUuidV4(req.actorId),
    resourceId: requireCanonicalUuidV4(req.resourceId),
    name: req.eventName, aggregateRevision: req.aggregateRevision,
    idempotencyKey: req.idempotencyKey,
    deliveryState: "not_scheduled" as const,
    canPersist: false as const, canDispatch: false as const,
  });
}
