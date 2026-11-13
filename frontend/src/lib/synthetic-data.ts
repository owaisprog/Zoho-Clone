// P3.01: explicitly fictional, local, read-only presentation data.
// Never replace these objects with real customer/merchant data or treat them
// as authenticated, provider-verified, or production information.

export type InternalApplicationStage =
  | "draft"
  | "needs_more_info"
  | "waiting_demo"
  | "handoff_pending"
  | "active_internal";

export interface DemoApplication {
  id: string;
  name: string;
  category: string;
  stage: InternalApplicationStage;
  owner: string;
  nextAction: string;
  updatedLabel: string;
}

export interface DemoLead {
  id: string;
  organization: string;
  contact: string;
  email: string;
  stage: "new" | "contacted" | "qualified";
  owner: string;
}

export const DEMO_ORGANIZATION = {
  id: "org_demo_orchid",
  name: "Orchid Payments Demo",
  description: "Entirely fictional sandbox organization",
} as const;

export const DEMO_APPLICATIONS: readonly DemoApplication[] = [
  {
    id: "APP-DEMO-101",
    name: "Demo River Retail",
    category: "Retail",
    stage: "draft",
    owner: "Demo Operations",
    nextAction: "Review synthetic checklist",
    updatedLabel: "Today (demo)",
  },
  {
    id: "APP-DEMO-102",
    name: "Demo Pine Market",
    category: "Convenience",
    stage: "needs_more_info",
    owner: "Demo Operations",
    nextAction: "Request demo follow-up",
    updatedLabel: "Yesterday (demo)",
  },
  {
    id: "APP-DEMO-103",
    name: "Demo Cedar Books",
    category: "Retail",
    stage: "waiting_demo",
    owner: "Demo Operations",
    nextAction: "Check unverified demo status",
    updatedLabel: "2 days ago (demo)",
  },
  {
    id: "APP-DEMO-104",
    name: "Demo Birch Bakery",
    category: "Food",
    stage: "handoff_pending",
    owner: "Demo Operations",
    nextAction: "Review internal handoff",
    updatedLabel: "2 days ago (demo)",
  },
  {
    id: "APP-DEMO-105",
    name: "Demo Lantern Cafe",
    category: "Hospitality",
    stage: "active_internal",
    owner: "Demo Operations",
    nextAction: "Complete internal notes",
    updatedLabel: "3 days ago (demo)",
  },
] as const;

export const DEMO_LEADS: readonly DemoLead[] = [
  {
    id: "LEAD-DEMO-101",
    organization: "Northstar Commerce Demo",
    contact: "Example Contact A",
    email: "contact-a@example.com",
    stage: "qualified",
    owner: "Demo Sales",
  },
  {
    id: "LEAD-DEMO-102",
    organization: "Copperline Systems Demo",
    contact: "Example Contact B",
    email: "contact-b@example.com",
    stage: "contacted",
    owner: "Demo Sales",
  },
  {
    id: "LEAD-DEMO-103",
    organization: "Sunward Studio Demo",
    contact: "Example Contact C",
    email: "contact-c@example.com",
    stage: "new",
    owner: "Demo Sales",
  },
  {
    id: "LEAD-DEMO-104",
    organization: "Harborlight Demo",
    contact: "Example Contact D",
    email: "contact-d@example.com",
    stage: "new",
    owner: "Demo Sales",
  },
] as const;

export const STAGE_LABELS: Record<InternalApplicationStage, string> = {
  draft: "Draft",
  needs_more_info: "Needs information",
  waiting_demo: "Waiting (demo)",
  handoff_pending: "Internal handoff",
  active_internal: "Active internally",
};

export const ATTENTION_STAGES: readonly InternalApplicationStage[] = [
  "needs_more_info",
  "waiting_demo",
  "handoff_pending",
];

export function getApplicationSummary(rows: readonly DemoApplication[]) {
  return {
    total: rows.length,
    needsAttention: rows.filter((r) => ATTENTION_STAGES.includes(r.stage)).length,
    internalActive: rows.filter((r) => r.stage === "active_internal").length,
  };
}

export function filterApplications(rows: readonly DemoApplication[], query: string) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [...rows];
  return rows.filter((row) =>
    [row.name, row.category, row.owner, row.nextAction, STAGE_LABELS[row.stage]]
      .some((value) => value.toLocaleLowerCase().includes(needle)),
  );
}

export function filterLeads(rows: readonly DemoLead[], query: string) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [...rows];
  return rows.filter((row) =>
    [row.organization, row.contact, row.email, row.owner, row.stage]
      .some((value) => value.toLocaleLowerCase().includes(needle)),
  );
}
