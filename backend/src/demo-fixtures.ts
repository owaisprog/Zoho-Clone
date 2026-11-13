// P3.02: Publicly readable ONLY because these are invented, fixed demo objects.
// No database, tenant, authentication, customer, processor, or payment information.
export const demoLeads = [
  { id: "LEAD-DEMO-101", organization: "Northstar Commerce Demo", contact: "Example Contact A", email: "contact-a@example.com", stage: "qualified", owner: "Demo Sales" },
  { id: "LEAD-DEMO-102", organization: "Copperline Systems Demo", contact: "Example Contact B", email: "contact-b@example.com", stage: "contacted", owner: "Demo Sales" },
  { id: "LEAD-DEMO-103", organization: "Sunward Studio Demo", contact: "Example Contact C", email: "contact-c@example.com", stage: "new", owner: "Demo Sales" },
  { id: "LEAD-DEMO-104", organization: "Harborlight Demo", contact: "Example Contact D", email: "contact-d@example.com", stage: "new", owner: "Demo Sales" },
] as const;

export const demoApplications = [
  { id: "APP-DEMO-101", name: "Demo River Retail", category: "Retail", stage: "draft", owner: "Demo Operations", nextAction: "Review synthetic checklist", updatedLabel: "Today (demo)" },
  { id: "APP-DEMO-102", name: "Demo Pine Market", category: "Convenience", stage: "needs_more_info", owner: "Demo Operations", nextAction: "Request demo follow-up", updatedLabel: "Yesterday (demo)" },
  { id: "APP-DEMO-103", name: "Demo Cedar Books", category: "Retail", stage: "waiting_demo", owner: "Demo Operations", nextAction: "Check unverified demo status", updatedLabel: "2 days ago (demo)" },
  { id: "APP-DEMO-104", name: "Demo Birch Bakery", category: "Food", stage: "handoff_pending", owner: "Demo Operations", nextAction: "Review internal handoff", updatedLabel: "2 days ago (demo)" },
  { id: "APP-DEMO-105", name: "Demo Lantern Cafe", category: "Hospitality", stage: "active_internal", owner: "Demo Operations", nextAction: "Complete internal notes", updatedLabel: "3 days ago (demo)" },
] as const;
