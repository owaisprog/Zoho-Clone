import { SYNTHETIC_ORG_ID, type VerifiedSyntheticTenant } from "./p4-membership.js";

/** CI-only synthetic contract. Never accept browser supplied actor/tenant as proof. */
export class P4OperationsDeniedError extends Error {
  constructor() { super("P4_OPERATIONS_DENIED"); }
}
export const P4_DEMO_USER = /^user_demo_[a-z]{2,16}$/;
export const P4_DEMO_FILE = SYNTHETIC_ORG_ID;
export function assertVerifiedSyntheticTenant(tenant: VerifiedSyntheticTenant | null): asserts tenant is VerifiedSyntheticTenant {
  if (!tenant || tenant.verified !== true || !SYNTHETIC_ORG_ID.test(tenant.orgId) ||
      !P4_DEMO_USER.test(tenant.userId) ||
      (tenant.role !== "OWNER" && tenant.role !== "MEMBER")) {
    throw new P4OperationsDeniedError();
  }
}
export function assertPositiveTime(nowMs: number): void {
  if (!Number.isSafeInteger(nowMs) || nowMs < 1 || nowMs > 8_640_000_000_000_000) {
    throw new P4OperationsDeniedError();
  }
}
