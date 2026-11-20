/** P4.16/19/20 fictional UI only, not verified enterprise records. */
export const P4_FAKE_SETTINGS = Object.freeze({
  name: "Demo Orchid Payments", locale: "en-PK",
  timeZone: "Asia/Karachi", currency: "PKR",
});
export type P4DemoAuditKind = "team.created" | "membership.revoked" | "org.preferences.changed";
export interface P4DemoAuditItem {
  id: string;
  event: P4DemoAuditKind;
  actor: string;
  date: string;
  before: "[REDACTED]";
  after: "[REDACTED]";
}
export const P4_DEMO_AUDIT: readonly P4DemoAuditItem[] = Object.freeze([
  Object.freeze({ id: "audit-demo-01", event: "team.created",
    actor: "Demo Alice", date: "2026-11-18", before: "[REDACTED]", after: "[REDACTED]" }),
  Object.freeze({ id: "audit-demo-02", event: "membership.revoked",
    actor: "Demo Alice", date: "2026-11-19", before: "[REDACTED]", after: "[REDACTED]" }),
  Object.freeze({ id: "audit-demo-03", event: "org.preferences.changed",
    actor: "Demo Alice", date: "2026-11-20", before: "[REDACTED]", after: "[REDACTED]" }),
]);
export function p4DemoAuditFilter(kind: unknown): readonly P4DemoAuditItem[] {
  if (kind === "all") return P4_DEMO_AUDIT;
  if (kind !== "team.created" && kind !== "membership.revoked" &&
      kind !== "org.preferences.changed") return [];
  return P4_DEMO_AUDIT.filter(event => event.event === kind);
}
export function p4DemoEffectiveTimeZone(
  userTimeZone: unknown, orgTimeZone: string,
): string {
  const valid = (zone: string): boolean => {
    try { new Intl.DateTimeFormat("en", { timeZone: zone }).format(new Date(0)); return true; }
    catch { return false; }
  };
  if (!valid(orgTimeZone)) return "UTC";
  if (typeof userTimeZone === "string" && userTimeZone.length <= 64 && valid(userTimeZone))
    return userTimeZone;
  return orgTimeZone;
}
