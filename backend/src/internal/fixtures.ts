import { InMemoryFictionalLeadRepository } from "./repository.js";
import type { InternalLead, PreviewMembership } from "./contracts.js";

// TWO strictly fictional, isolated organizations; never actual customers.
export const demoMemberships: readonly PreviewMembership[] = [
  { orgId: "org_demo_orchid", userId: "user_demo_alice", active: true, roles: ["SALES_EDITOR"], scope: "owned" },
  { orgId: "org_demo_orchid", userId: "user_demo_bob", active: true, roles: ["SALES_READER"], scope: "all" },
  { orgId: "org_demo_orchid", userId: "user_demo_admin", active: true, roles: ["ORG_ADMIN"], scope: "all" },
  { orgId: "org_demo_orchid", userId: "user_demo_eve", active: false, roles: ["SALES_EDITOR"], scope: "all" },
  { orgId: "org_demo_cedar", userId: "user_demo_carla", active: true, roles: ["SALES_EDITOR"], scope: "all" },
] as const;
export const internalDemoLeads: readonly InternalLead[] = [
  { id: "LEAD-DEMO-201", orgId: "org_demo_orchid", ownerId: "user_demo_alice", organization: "Demo Orchid Shops", contact: "Example Contact A", email: "orchid@example.com", stage: "new", version: 1 },
  { id: "LEAD-DEMO-202", orgId: "org_demo_orchid", ownerId: "user_demo_bob", organization: "Demo Maple Store", contact: "Example Contact B", email: "maple@example.com", stage: "contacted", version: 2 },
  { id: "LEAD-DEMO-301", orgId: "org_demo_cedar", ownerId: "user_demo_carla", organization: "Demo Cedar Studio", contact: "Example Contact C", email: "cedar@example.com", stage: "qualified", version: 3 },
] as const;
export function createFictionalLeadRepository() {
  return new InMemoryFictionalLeadRepository(internalDemoLeads, demoMemberships);
}
