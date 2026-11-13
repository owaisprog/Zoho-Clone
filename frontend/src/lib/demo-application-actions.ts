import type { DemoApplication, ApplicationStage } from "@zoho-clone/demo-contracts";

// Only an invented internal work queue. Not processor lifecycle transitions.
const NEXT: Readonly<Record<ApplicationStage, ApplicationStage | null>> = {
  draft: "needs_more_info",
  needs_more_info: "waiting_demo",
  waiting_demo: "handoff_pending",
  handoff_pending: "active_internal",
  active_internal: null,
};
export interface DemoApplicationAction {
  ok: boolean;
  records: DemoApplication[];
  message: string;
}
export function nextDemoStage(stage: ApplicationStage): ApplicationStage | null {
  return NEXT[stage] ?? null;
}
export function advanceDemoApplication(
  records: readonly DemoApplication[], id: string,
): DemoApplicationAction {
  const item = records.find(row => row.id === id);
  if (!item || !/^APP-DEMO-\d{3}$/.test(id)) {
    return { ok: false, records: [...records], message: "Fictional application not found." };
  }
  const next = nextDemoStage(item.stage);
  if (!next) {
    return { ok: false, records: [...records], message: "This internal demo stage has no next step." };
  }
  return {
    ok: true,
    records: records.map(row => row.id === id
      ? { ...row, stage: next, nextAction: "Review next synthetic checklist", updatedLabel: "Just now (demo)" }
      : { ...row }),
    message: id + " moved to the next fictional internal stage. No provider status changed.",
  };
}