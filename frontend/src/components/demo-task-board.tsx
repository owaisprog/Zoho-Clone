"use client";

import { useState } from "react";
import { ArrowRight, RotateCcw, Search } from "lucide-react";
import type { DemoTask, TaskStatus } from "@zoho-clone/demo-contracts";
import { DemoPager } from "./demo-pager";
import { advanceDemoTask, filterDemoTasks, taskSummary } from "@/lib/demo-task-actions";
import { sortDemoRows, paginateDemoRows, type SortDirection } from "@/lib/demo-table";

type Filter = TaskStatus | "all";
const STATUSES: readonly { value: Filter; label: string }[] = [
  { value: "all", label: "All" }, { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" }, { value: "done", label: "Done" },
];
const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do", in_progress: "In progress", done: "Done",
};

export function DemoTaskBoard({ initialRecords }: { initialRecords: readonly DemoTask[] }) {
  const [records, setRecords] = useState<DemoTask[]>(() => initialRecords.map(row => ({ ...row })));
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Filter>("all");
  const [sort, setSort] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const summary = taskSummary(records);
  const filtered = sortDemoRows(filterDemoTasks(records, query, status), row => row.title, sort);
  const paginated = paginateDemoRows(filtered, page, 3);

  function advance(id: string) {
    const result = advanceDemoTask(records, id);
    setNotice(result.message);
    if (result.ok) setRecords(result.records);
  }
  function reset() {
    setRecords(initialRecords.map(row => ({ ...row })));
    setQuery(""); setStatus("all"); setSort("asc"); setPage(1);
    setNotice("Fictional task checklist restored. Nothing was saved to a server.");
  }

  return (
    <section className="data-card" aria-label="Fictional task checklist">
      <div className="data-card-header">
        <div><h2>Internal task checklist</h2><p>{summary.pending} pending · {summary.completed} done · all examples are invented</p></div>
        <button type="button" className="btn" onClick={reset}><RotateCcw size={15} aria-hidden="true"/> Reset demo tasks</button>
      </div>
      <div className="demo-control-row">
        <div role="group" aria-label="Filter task stage" className="demo-filter-group">
          {STATUSES.map(item =>
            <button key={item.value} type="button" className={"stage-filter" + (status === item.value ? " selected" : "")}
              aria-pressed={status === item.value} onClick={() => { setStatus(item.value); setPage(1); }}>{item.label}</button>
          )}
        </div>
        <label className="search-box">
          <Search size={16} aria-hidden="true"/><span className="sr-only">Search fictional tasks</span>
          <input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }}
            placeholder="Search task or demo reference"/>
        </label>
        <label className="demo-sort-label">Sort
          <select value={sort} onChange={event => { setSort(event.target.value as SortDirection); setPage(1); }}
            aria-label="Sort fictional tasks by title">
            <option value="asc">Title A–Z</option><option value="desc">Title Z–A</option>
          </select>
        </label>
      </div>
      {notice && <p role="status" className="demo-notice">{notice}</p>}
      <div className="demo-task-list">
        {paginated.rows.map(task => (
          <article className="demo-task-card" key={task.id}>
            <div className="demo-task-main">
              <strong>{task.title}</strong>
              <span>{task.id} · {task.relatedId} · {task.owner} · {task.dueLabel}</span>
            </div>
            <span className={"status-pill demo-task-" + task.status}>{STATUS_LABELS[task.status]}</span>
            <button type="button" className="btn" disabled={task.status === "done"} onClick={() => advance(task.id)}
              aria-label={"Advance fictional task " + task.id}>
              {task.status === "done" ? "Done (demo)" : "Next internal step"} <ArrowRight size={14} aria-hidden="true"/>
            </button>
          </article>
        ))}
        {paginated.rows.length === 0 && <p className="empty-cell">No fictional tasks match these filters.</p>}
      </div>
      <DemoPager page={paginated.page} pageCount={paginated.pageCount} total={paginated.total} onChange={setPage}/>
      <p className="demo-footer-note">All task changes are local to this browser session; refreshing restores the fictional dataset.</p>
    </section>
  );
}