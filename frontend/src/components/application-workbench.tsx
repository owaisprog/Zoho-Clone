"use client";

import { useState } from "react";
import { ArrowRight, RotateCcw, Search } from "lucide-react";
import type { DemoApplication, ApplicationStage } from "@zoho-clone/demo-contracts";
import { STAGE_LABELS, filterApplications } from "@/lib/synthetic-data";
import { advanceDemoApplication, nextDemoStage } from "@/lib/demo-application-actions";
import { sortDemoRows, paginateDemoRows, type SortDirection } from "@/lib/demo-table";
import { DemoPager } from "./demo-pager";

type Filter = ApplicationStage | "all";
const FILTERS: readonly {value: Filter; label: string}[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "needs_more_info", label: "Needs info" },
  { value: "waiting_demo", label: "Waiting (demo)" },
  { value: "handoff_pending", label: "Internal handoff" },
  { value: "active_internal", label: "Active internally" },
];

export function ApplicationWorkbench({ initialRecords }: { initialRecords: readonly DemoApplication[] }) {
  const [records, setRecords] = useState<DemoApplication[]>(() => initialRecords.map(row => ({ ...row })));
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const filtered = sortDemoRows(
    filterApplications(records, query).filter(row => filter === "all" || row.stage === filter),
    row => row.name, sort,
  );
  const paginated = paginateDemoRows(filtered, page, 3);

  function advance(id: string) {
    const result = advanceDemoApplication(records, id);
    setNotice(result.message);
    if (result.ok) setRecords(result.records);
  }
  function reset() {
    setRecords(initialRecords.map(row => ({ ...row })));
    setQuery(""); setFilter("all"); setSort("asc"); setPage(1);
    setNotice("The fictional application queue was restored. No changes were saved.");
  }

  return (
    <section className="data-card" aria-label="Fictional internal application workbench">
      <div className="data-card-header">
        <div><h2>Internal application queue</h2><p>All stages and names are invented, not provider boarding statuses.</p></div>
        <button type="button" className="btn" onClick={reset}><RotateCcw size={15} aria-hidden="true"/> Reset demo queue</button>
      </div>
      <div className="demo-control-row">
        <div className="demo-filter-group" role="group" aria-label="Filter internal fictional application stages">
          {FILTERS.map(item => (
            <button type="button" key={item.value} className={"stage-filter" + (filter === item.value ? " selected" : "")}
              aria-pressed={filter === item.value} onClick={() => { setFilter(item.value); setPage(1); }}>
              {item.label} <strong>{item.value === "all" ? records.length : records.filter(row => row.stage === item.value).length}</strong>
            </button>
          ))}
        </div>
        <label className="search-box">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search fictional applications</span>
          <input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }}
            placeholder="Search fictional queue"/>
        </label>
        <label className="demo-sort-label">Sort
          <select aria-label="Sort fictional applications by company" value={sort}
            onChange={event => { setSort(event.target.value as SortDirection); setPage(1); }}>
            <option value="asc">Merchant A–Z</option><option value="desc">Merchant Z–A</option>
          </select>
        </label>
      </div>
      {notice && <p className="demo-notice" role="status">{notice}</p>}
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th scope="col">Fictional merchant</th><th scope="col">Internal stage</th>
            <th scope="col">Fictional owner</th><th scope="col">Next demo action</th><th scope="col">Demo updated</th><th scope="col">Action</th></tr></thead>
          <tbody>
            {paginated.rows.map(record => (
              <tr key={record.id}>
                <td><span className="primary-cell">{record.name}</span><span className="secondary-cell">{record.category} · {record.id}</span></td>
                <td><span className={"status-pill stage-" + record.stage}>{STAGE_LABELS[record.stage]}</span></td>
                <td>{record.owner}</td><td>{record.nextAction}</td><td className="subdued-cell">{record.updatedLabel}</td>
                <td><button type="button" className="btn" disabled={!nextDemoStage(record.stage)}
                  onClick={() => advance(record.id)} aria-label={"Advance fictional internal application " + record.id}>
                  {nextDemoStage(record.stage) ? "Next internal step" : "End of demo"}
                  <ArrowRight size={14} aria-hidden="true"/>
                </button></td>
              </tr>
            ))}
            {paginated.rows.length === 0 && <tr><td colSpan={6} className="empty-cell">No fictional applications match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <DemoPager page={paginated.page} pageCount={paginated.pageCount} total={paginated.total} onChange={setPage}/>
      <p className="demo-footer-note">Changing internal stages is a temporary browser action, not processor onboarding or payment approval.</p>
    </section>
  );
}