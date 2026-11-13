import type { DemoLead, DemoApplication } from "@zoho-clone/demo-contracts";

export const LEAD_PIPELINE = [
  { stage: "new", label: "New" },
  { stage: "contacted", label: "Contacted" },
  { stage: "qualified", label: "Qualified" },
] as const;

export function getLeadPipeline(rows: readonly DemoLead[]) {
  return LEAD_PIPELINE.map(({ stage, label }) => {
    const count = rows.filter((row) => row.stage === stage).length;
    return { stage, label, count, percentage: rows.length ? Math.round(count * 100 / rows.length) : 0 };
  });
}

export function getDemoWorkload(rows: readonly DemoApplication[], leads: readonly DemoLead[]) {
  return {
    applications: rows.length,
    leads: leads.length,
    actions: rows.filter((row) => row.stage === "needs_more_info" ||
      row.stage === "handoff_pending" || row.stage === "waiting_demo").length,
    qualified: leads.filter((row) => row.stage === "qualified").length,
  };
}
