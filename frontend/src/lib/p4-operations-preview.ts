/** Fictional P4.21-P4.25 display models. No real tenant, billing, file or support data. */
export const P4_OPERATIONS_FILE = Object.freeze({
  label: "Demo onboarding checklist.pdf", version: 2,
  state: "Quarantined (fictional)", downloadEnabled: false, deleteEnabled: false,
});
export interface P4DemoNotice {
  id: string;
  title: string;
  category: "membership" | "task";
  link: "/app/organization/memberships" | "/app/tasks";
  read: boolean;
}
export const P4_OPERATIONS_NOTICES: readonly P4DemoNotice[] = Object.freeze([
  Object.freeze({ id: "notice_demo_invite01", title: "Demo workspace invite", category: "membership" as const,
    link: "/app/organization/memberships" as const, read: false }),
  Object.freeze({ id: "notice_demo_task01", title: "Demo task reminder", category: "task" as const,
    link: "/app/tasks" as const, read: false }),
]);
export function markFakeNoticeRead(notices: readonly P4DemoNotice[], id: string): readonly P4DemoNotice[] {
  return Object.freeze(notices.map(n => Object.freeze({ ...n, read: n.id === id ? true : n.read })));
}
export function simulateFakeClosure(
  choice: "export" | "closure", dependenciesCleared: boolean,
): Readonly<{ label: string; runnable: false; jobsCreated: 0 }> {
  return Object.freeze({
    label: dependenciesCleared
      ? (choice === "export" ? "Export preparation requires approved providers" :
        "Closure is not executable in this demo")
      : "Outstanding billing, legal and retention checks block this preview",
    runnable: false as const, jobsCreated: 0 as const,
  });
}
