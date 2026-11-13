import type { DemoTask, TaskStatus } from "@zoho-clone/demo-contracts";

const NEXT: Readonly<Record<TaskStatus, TaskStatus | null>> = {
  todo: "in_progress",
  in_progress: "done",
  done: null,
};
export function nextDemoTaskStatus(status: TaskStatus): TaskStatus | null {
  return NEXT[status] ?? null;
}
export function advanceDemoTask(rows: readonly DemoTask[], id: string) {
  const found = rows.find(row => row.id === id);
  if (!found || !/^TASK-DEMO-\d{3}$/.test(id)) {
    return { ok: false as const, records: [...rows], message: "Fictional task was not found." };
  }
  const next = nextDemoTaskStatus(found.status);
  if (!next) {
    return { ok: false as const, records: [...rows], message: "Fictional task already marked done." };
  }
  return {
    ok: true as const,
    records: rows.map(row => row.id === id ? { ...row, status: next } : { ...row }),
    message: "Changed " + id + " in browser memory only. No external task was updated.",
  };
}
export function filterDemoTasks(rows: readonly DemoTask[], query: string, status: TaskStatus | "all") {
  const needle = query.trim().toLocaleLowerCase();
  return rows.filter(row => (status === "all" || row.status === status) &&
    (!needle || [row.id, row.title, row.owner, row.relatedId].some(x => x.toLocaleLowerCase().includes(needle))));
}
export function taskSummary(rows: readonly DemoTask[]) {
  return {
    total: rows.length,
    pending: rows.filter(row => row.status !== "done").length,
    completed: rows.filter(row => row.status === "done").length,
  };
}