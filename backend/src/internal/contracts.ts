/**
 * P3.13–P3.17: REAL typed internal service boundaries, but the adapter and
 * all records below are fictional. NOT a production identity, tenant or DB model.
 * The final ID encoding (OPEN-002), identity provider (OPEN-001), and
 * record-grant rules (OPEN-003) remain subject to owner review.
 */
export type DemoRole = "SALES_READER" | "SALES_EDITOR" | "ORG_ADMIN";
export type RecordScope = "all" | "owned";
export type LeadStage = "new" | "contacted" | "qualified";

export interface VerifiedPreviewActor {
  userId: string;
  verified: true;
}
export interface PreviewMembership {
  userId: string;
  orgId: string;
  active: boolean;
  roles: readonly DemoRole[];
  scope: RecordScope;
}
export interface InternalLead {
  id: string;
  orgId: string;
  ownerId: string;
  organization: string;
  contact: string;
  email: string;
  stage: LeadStage;
  version: number;
}
export interface LeadSummary {
  id: string;
  organization: string;
  stage: LeadStage;
  version: number;
}
export interface LeadDetail extends LeadSummary {
  contact?: string;
  email?: string;
}
export interface LeadCreate {
  organization: string;
  contact: string;
  email: string;
}
export interface LeadPatch {
  stage: LeadStage;
}
export type FieldError = "BAD_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "INVALID_STAGE";

export class InternalApiError extends Error {
  constructor(public readonly httpStatus: number, public readonly code: FieldError) {
    super(code);
  }
}
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}
function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isPlainObject(value) && Object.keys(value).length === keys.length &&
    keys.every(key => Object.hasOwn(value, key));
}
export function parseLeadCreate(value: unknown): LeadCreate {
  if (!exactKeys(value, ["organization", "contact", "email"]) ||
      typeof value.organization !== "string" ||
      !/^(Demo [A-Za-z][A-Za-z0-9 &.'-]{1,70}|[A-Za-z][A-Za-z0-9 &.'-]{1,70} Demo)$/.test(value.organization) ||
      typeof value.contact !== "string" || !/^Example [A-Za-z][A-Za-z .'-]{1,60}$/.test(value.contact) ||
      typeof value.email !== "string" || !/^[a-z0-9][a-z0-9.-]{0,45}@example\.com$/.test(value.email)) {
    throw new InternalApiError(400, "BAD_REQUEST");
  }
  return { organization: value.organization, contact: value.contact, email: value.email };
}
export function parseLeadPatch(value: unknown): LeadPatch {
  if (!exactKeys(value, ["stage"]) ||
      (value.stage !== "new" && value.stage !== "contacted" && value.stage !== "qualified")) {
    throw new InternalApiError(400, "BAD_REQUEST");
  }
  return { stage: value.stage };
}
export function parseDemoId(value: unknown, kind: "org" | "lead"): string {
  const pattern = kind === "org" ? /^org_demo_[a-z]{2,16}$/ : /^LEAD-DEMO-\d{3}$/;
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new InternalApiError(404, "NOT_FOUND");
  }
  return value;
}
export function parseExpectedVersion(value: unknown): number {
  if (typeof value !== "string" || !/^"[1-9]\d{0,8}"$/.test(value)) {
    throw new InternalApiError(400, "BAD_REQUEST");
  }
  const version = Number(value.slice(1, -1));
  if (!Number.isSafeInteger(version)) throw new InternalApiError(400, "BAD_REQUEST");
  return version;
}
export function parseIdempotencyKey(value: unknown): string {
  if (typeof value !== "string" || !/^DEMO-[a-zA-Z0-9-]{6,60}$/.test(value)) {
    throw new InternalApiError(400, "BAD_REQUEST");
  }
  return value;
}
export function projectLead(row: InternalLead, contactAllowed: boolean): LeadDetail {
  const publicFields: LeadDetail = {
    id: row.id, organization: row.organization,
    stage: row.stage, version: row.version,
  };
  if (contactAllowed) {
    publicFields.contact = row.contact;
    publicFields.email = row.email;
  }
  return publicFields;
}
export function assertStageTransition(previous: LeadStage, requested: LeadStage): void {
  const next: Record<LeadStage, LeadStage | null> = {
    new: "contacted",
    contacted: "qualified",
    qualified: null,
  };
  if (next[previous] !== requested) throw new InternalApiError(422, "INVALID_STAGE");
}