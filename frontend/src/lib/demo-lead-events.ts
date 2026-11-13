// P3.08 ephemeral, generated-only activity. No arbitrary note text,
// server write, storage or claim that a real contact was made.
export type DemoLeadEventKind = "created" | "edited";
export interface DemoLeadEvent {
  id: string;
  leadId: string;
  kind: DemoLeadEventKind;
  description: string;
}

export function appendDemoLeadEvent(
  history: readonly DemoLeadEvent[], leadId: string, kind: DemoLeadEventKind,
): DemoLeadEvent[] {
  if (!/^LEAD-DEMO-\d{3}$/.test(leadId)) return [...history];
  const lastId = history.reduce((max, event) => {
    const match = /^EVENT-DEMO-(\d+)$/.exec(event.id);
    return Math.max(max, match ? Number(match[1]) : 0);
  }, 0);
  const event: DemoLeadEvent = {
    id: "EVENT-DEMO-" + (lastId + 1),
    leadId,
    kind,
    description: kind === "created" ? "Fictional lead added in this session"
      : "Fictional lead edited in this session",
  };
  return [...history, event].slice(-20);
}

export function eventsForDemoLead(history: readonly DemoLeadEvent[], leadId: string) {
  return history.filter((event) => event.leadId === leadId).slice().reverse();
}