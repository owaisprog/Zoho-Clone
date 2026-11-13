"use client";

import { useState, type FormEvent } from "react";
import { Pencil, Plus, Search, X } from "lucide-react";
import type { DemoLead, LeadStage } from "@zoho-clone/demo-contracts";
import { filterLeads } from "@/lib/synthetic-data";
import { getLeadPipeline } from "@/lib/demo-analytics";
import { saveDemoLead, type DemoLeadDraft, type DraftErrors } from "@/lib/demo-lead-draft";

const blank: DemoLeadDraft = {
  organization: "Demo ", contact: "Example ", email: "new-contact@example.com", stage: "new",
};
type StageFilter = "all" | LeadStage;

export function LeadWorkbench({ initialRecords }: { initialRecords: readonly DemoLead[] }) {
  // State is deliberately in memory: no localStorage, network POST, or database.
  const [records, setRecords] = useState<DemoLead[]>(() => initialRecords.map((row) => ({ ...row })));
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<StageFilter>("all");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DemoLeadDraft>({ ...blank });
  const [errors, setErrors] = useState<DraftErrors>({});
  const [notice, setNotice] = useState("");
  const filtered = filterLeads(records, query).filter((row) => stage === "all" || row.stage === stage);
  const pipeline = getLeadPipeline(records);

  function beginAdd() {
    setOpen(true);
    setEditingId(null);
    setDraft({ ...blank });
    setErrors({});
    setNotice("");
  }
  function beginEdit(row: DemoLead) {
    setOpen(true);
    setEditingId(row.id);
    setDraft({ organization: row.organization, contact: row.contact, email: row.email, stage: row.stage });
    setErrors({});
    setNotice("");
  }
  function closeEditor() {
    setOpen(false);
    setEditingId(null);
    setErrors({});
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = saveDemoLead(records, draft, editingId);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setRecords(result.records);
    setStage("all");
    setQuery("");
    setNotice((editingId ? "Updated " : "Added ") + result.id + " in this browser session only. Reloading restores the original fictional records.");
    closeEditor();
  }

  return (
    <section className="data-card" aria-label="Fictional lead workbench">
      <div className="data-card-header">
        <div>
          <h2>Lead workbench</h2>
          <p>Read and edit fictional records in memory · never sent to server</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={beginAdd}>
          <Plus size={16} aria-hidden="true" /> Add fictional lead
        </button>
      </div>

      <div className="lead-stages" role="group" aria-label="Filter fictional lead stages">
        <button type="button" className={stage === "all" ? "stage-filter selected" : "stage-filter"} onClick={() => setStage("all")} aria-pressed={stage === "all"}>
          All <strong>{records.length}</strong>
        </button>
        {pipeline.map((item) => (
          <button key={item.stage} type="button" className={stage === item.stage ? "stage-filter selected" : "stage-filter"}
            onClick={() => setStage(item.stage)} aria-pressed={stage === item.stage}>
            {item.label} <strong>{item.count}</strong>
          </button>
        ))}
        <label className="search-box lead-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search fictional leads</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find fictional lead" />
        </label>
      </div>

      {notice && <p className="demo-notice" role="status">{notice}</p>}

      {open && (
        <form onSubmit={save} className="demo-editor" aria-label={editingId ? "Edit fictional lead" : "Add fictional lead"} noValidate>
          <div className="demo-editor-heading">
            <div><h3>{editingId ? "Edit fictional lead" : "New fictional lead"}</h3>
              <p>Use invented names and an @example.com email. This is not saved to any server.</p></div>
            <button type="button" className="icon-button" onClick={closeEditor} aria-label="Close lead editor"><X size={16} /></button>
          </div>
          <div className="demo-editor-grid">
            <label className="demo-field">Fictional company
              <input value={draft.organization} maxLength={75} onChange={(e) => setDraft({ ...draft, organization: e.target.value })} aria-invalid={!!errors.organization} />
              {errors.organization && <small role="alert">{errors.organization}</small>}
            </label>
            <label className="demo-field">Fictional contact
              <input value={draft.contact} maxLength={70} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} aria-invalid={!!errors.contact} />
              {errors.contact && <small role="alert">{errors.contact}</small>}
            </label>
            <label className="demo-field">Example.com email
              <input type="email" value={draft.email} maxLength={60} onChange={(e) => setDraft({ ...draft, email: e.target.value })} aria-invalid={!!errors.email} />
              {errors.email && <small role="alert">{errors.email}</small>}
            </label>
            <label className="demo-field">Internal demo stage
              <select value={draft.stage} onChange={(e) => setDraft({ ...draft, stage: e.target.value as LeadStage })} aria-invalid={!!errors.stage}>
                <option value="new">New</option><option value="contacted">Contacted</option><option value="qualified">Qualified</option>
              </select>
              {errors.stage && <small role="alert">{errors.stage}</small>}
            </label>
          </div>
          {errors.form && <p className="field-error" role="alert">{errors.form}</p>}
          <div className="action-row">
            <button className="btn btn-primary" type="submit">Apply demo change (session only)</button>
            <button className="btn" type="button" onClick={closeEditor}>Cancel</button>
          </div>
        </form>
      )}

      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th scope="col">Fictional company</th><th scope="col">Example contact</th><th scope="col">Demo stage</th><th scope="col">Owner</th><th scope="col">Action</th></tr></thead>
          <tbody>
            {filtered.map((lead) => (
              <tr key={lead.id}>
                <td><span className="primary-cell">{lead.organization}</span><span className="secondary-cell">{lead.id}</span></td>
                <td>{lead.contact}<span className="secondary-cell">{lead.email}</span></td>
                <td><span className={"status-pill stage-" + lead.stage}>{lead.stage}</span></td>
                <td>{lead.owner}</td>
                <td><button type="button" className="btn" onClick={() => beginEdit(lead)} aria-label={"Edit fictional lead " + lead.id}>
                  <Pencil size={14} aria-hidden="true" /> Edit demo</button></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="empty-cell">No fictional leads match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="data-card-footer" role="status" aria-live="polite">
        <span>{filtered.length} of {records.length} fictional leads</span>
        <span>Changes are discarded on refresh · no CRM API writes</span>
      </div>
    </section>
  );
}
