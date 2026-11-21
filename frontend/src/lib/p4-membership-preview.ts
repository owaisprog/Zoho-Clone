/**
 * P4.06-10 browser-only fictional membership examples.
 * These strings are NOT a tenant session, API authorization or persisted user.
 */
export interface FictionalWorkspaceOption {
  orgId: string;
  displayName: string;
  role: "OWNER" | "MEMBER";
  active: true;
}
export const FICTIONAL_WORKSPACES: readonly FictionalWorkspaceOption[] = Object.freeze([
  Object.freeze({
    orgId: "10000000-0000-4000-8000-000000000001",
    displayName: "Demo Maple Payments", role: "OWNER", active: true as const,
  }),
  Object.freeze({
    orgId: "10000000-0000-4000-8000-000000000002",
    displayName: "Demo Cedar Payments", role: "MEMBER", active: true as const,
  }),
]);

export function chooseFictionalWorkspace(
  requestedId: unknown,
  options: readonly FictionalWorkspaceOption[] = FICTIONAL_WORKSPACES,
): FictionalWorkspaceOption | null {
  if (typeof requestedId !== "string") return null;
  const match = options.find(x => x.orgId === requestedId && x.active === true);
  if (!match || !["OWNER", "MEMBER"].includes(match.role)) return null;
  return Object.freeze({ ...match });
}

export function normalizeFictionalInvite(email: unknown, selected: FictionalWorkspaceOption): string | null {
  if (selected.active !== true || selected.role !== "OWNER" ||
      typeof email !== "string" || email !== email.trim() || email.length > 180 ||
      !/^[a-z0-9._+%-]+@example\.com$/i.test(email)) return null;
  return email.toLowerCase();
}
