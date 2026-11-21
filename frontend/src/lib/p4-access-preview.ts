/**
 * P4.12-15 browser-only preview. Never use these static values for API
 * authorization or actual customer/team membership decisions.
 */
export type FictionalRole = "OWNER" | "MEMBER";
export type FictionalAction =
  "org.members.read" | "org.members.manage" |
  "crm.leads.read.own" | "crm.leads.read.all" |
  "teams.read.assigned" | "teams.manage.assigned";

export const FICTIONAL_ACCESS_MATRIX: Readonly<Record<FictionalRole, readonly FictionalAction[]>> = Object.freeze({
  OWNER: Object.freeze([
    "org.members.read", "org.members.manage", "crm.leads.read.own",
    "crm.leads.read.all", "teams.read.assigned", "teams.manage.assigned",
  ] as const),
  MEMBER: Object.freeze(["crm.leads.read.own", "teams.read.assigned"] as const),
});

export interface FictionalTeamPreview {
  id: string;
  orgId: string;
  departmentName: string;
  displayName: string;
  managerId: string;
  active: true;
}
export const FICTIONAL_TEAM_PREVIEWS: readonly FictionalTeamPreview[] = Object.freeze([
  Object.freeze({ id: "team_demo_sales", orgId: "10000000-0000-4000-8000-000000000001",
    departmentName: "Demo Sales", displayName: "Demo Sales Team",
    managerId: "user_demo_bob", active: true }),
  Object.freeze({ id: "team_demo_support", orgId: "10000000-0000-4000-8000-000000000001",
    departmentName: "Demo Support", displayName: "Demo Support Team",
    managerId: "user_demo_alice", active: true }),
]);
export function fictionalActionPreview(
  role: FictionalRole,
  permission: FictionalAction,
  options: { sameOrg: boolean; ownsRecord: boolean; memberActive: boolean; teamAssigned: boolean; teamManager: boolean },
): boolean {
  if (!options.memberActive || !options.sameOrg ||
      !FICTIONAL_ACCESS_MATRIX[role]?.includes(permission)) return false;
  if (permission === "org.members.manage") return role === "OWNER";
  if (permission === "crm.leads.read.own") return options.ownsRecord;
  if (permission === "teams.read.assigned") return options.teamAssigned;
  if (permission === "teams.manage.assigned") return options.teamAssigned && options.teamManager;
  return true;
}
export function visibleFictionalTeams(
  memberId: string,
  role: FictionalRole,
  active: boolean,
): readonly FictionalTeamPreview[] {
  if (!active || !/^user_demo_(?:alice|bob)$/.test(memberId)) return [];
  return FICTIONAL_TEAM_PREVIEWS.filter(team => role === "OWNER" || team.managerId === memberId);
}
