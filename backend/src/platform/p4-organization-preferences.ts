import { SYNTHETIC_ORG_ID, type VerifiedSyntheticTenant } from "./p4-membership.js";

/**
 * P4.16: fictional org settings contract; not mounted on public Express.
 * Billing currency is display configuration, never a payment or invoice change.
 */
export type P4Currency = "USD" | "PKR" | "EUR";
export interface P4OrganizationPreferences {
  orgId: string;
  name: string;
  locale: string;
  timeZone: string;
  currency: P4Currency;
  revision: number;
}
export interface P4PreferenceInput {
  name: string;
  locale: string;
  timeZone: string;
  currency: P4Currency;
}
export interface P4PreferenceRepository {
  find(orgId: string): Promise<P4OrganizationPreferences | null>;
  /** Must perform a guarded UPDATE by orgId AND current revision. */
  replace(orgId: string, expectedRevision: number, values: P4PreferenceInput): Promise<P4OrganizationPreferences | null>;
}
export class P4PreferencesDeniedError extends Error {
  constructor() { super("P4_ORG_PREFERENCES_DENIED"); }
}
function validTimeZone(timeZone: string): boolean {
  try { new Intl.DateTimeFormat("en", { timeZone }).format(new Date(0)); return true; }
  catch { return false; }
}
export function validateP4PreferenceInput(input: unknown): Readonly<P4PreferenceInput> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new P4PreferencesDeniedError();
  const raw = input as Record<string, unknown>;
  if (Object.keys(raw).sort().join(",") !== "currency,locale,name,timeZone" ||
      typeof raw.name !== "string" || !/^Demo [A-Za-z][A-Za-z0-9 &' -]{2,50}$/.test(raw.name) ||
      typeof raw.locale !== "string" || !/^(?:en-US|en-GB|en-PK)$/.test(raw.locale) ||
      typeof raw.timeZone !== "string" || raw.timeZone.length > 64 || !validTimeZone(raw.timeZone) ||
      (raw.currency !== "USD" && raw.currency !== "PKR" && raw.currency !== "EUR")) {
    throw new P4PreferencesDeniedError();
  }
  return Object.freeze({
    name: raw.name, locale: raw.locale, timeZone: raw.timeZone, currency: raw.currency,
  });
}
function requireTenant(tenant: VerifiedSyntheticTenant) {
  if (!tenant || tenant.verified !== true || !SYNTHETIC_ORG_ID.test(tenant.orgId) ||
      !/^user_demo_[a-z]{2,16}$/.test(tenant.userId)) throw new P4PreferencesDeniedError();
}
export async function readP4OrganizationPreferences(
  tenant: VerifiedSyntheticTenant, repo: P4PreferenceRepository,
): Promise<P4OrganizationPreferences> {
  requireTenant(tenant);
  try {
    const row = await repo.find(tenant.orgId);
    if (!row || row.orgId !== tenant.orgId || row.revision < 1) throw new P4PreferencesDeniedError();
    validateP4PreferenceInput(row);
    return Object.freeze({ ...row });
  } catch { throw new P4PreferencesDeniedError(); }
}
export async function updateP4OrganizationPreferences(
  tenant: VerifiedSyntheticTenant, input: unknown, expectedRevision: unknown,
  repo: P4PreferenceRepository,
): Promise<P4OrganizationPreferences> {
  requireTenant(tenant);
  if (tenant.role !== "OWNER" || !Number.isSafeInteger(expectedRevision) ||
      (expectedRevision as number) < 1) throw new P4PreferencesDeniedError();
  const valid = validateP4PreferenceInput(input);
  try {
    // Exactly the server-authorized org is used, never a body orgId.
    const result = await repo.replace(tenant.orgId, expectedRevision as number, valid);
    if (!result || result.orgId !== tenant.orgId || result.revision !== (expectedRevision as number) + 1)
      throw new P4PreferencesDeniedError();
    return Object.freeze({ ...result });
  } catch { throw new P4PreferencesDeniedError(); }
}
/** User's preferred timezone has precedence over the org's default. */
export function effectiveP4TimeZone(userOverride: unknown, orgTimeZone: string): string {
  if (!validTimeZone(orgTimeZone)) throw new P4PreferencesDeniedError();
  if (typeof userOverride === "string" && userOverride.length <= 64 && validTimeZone(userOverride))
    return userOverride;
  return orgTimeZone;
}
