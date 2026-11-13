"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import {
  DEMO_APPLICATIONS,
  DEMO_LEADS,
  STAGE_LABELS,
  type DemoApplication,
  type DemoLead,
  filterApplications,
  filterLeads,
} from "@/lib/synthetic-data";

export function ApplicationTable({ records = DEMO_APPLICATIONS }: { records?: readonly DemoApplication[] }) {
  const [query, setQuery] = useState("");
  const rows = filterApplications(records, query);
  return (
    <div className="data-card">
      <div className="data-card-header">
        <div>
          <h2>Application queue</h2>
          <p>Sample internal records · read-only</p>
        </div>
        <label className="search-box">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search fictional applications</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search fictional applications"
          />
        </label>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr>
            <th scope="col">Merchant</th>
            <th scope="col">Internal stage</th>
            <th scope="col">Owner</th>
            <th scope="col">Next action</th>
            <th scope="col">Updated</th>
          </tr></thead>
          <tbody>
            {rows.map((record) => (
              <tr key={record.id}>
                <td><span className="primary-cell">{record.name}</span><span className="secondary-cell">{record.category} · {record.id}</span></td>
                <td><span className={"status-pill stage-" + record.stage}>{STAGE_LABELS[record.stage]}</span></td>
                <td>{record.owner}</td>
                <td>{record.nextAction}</td>
                <td className="subdued-cell">{record.updatedLabel}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="empty-cell">No fictional records match this search.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="data-card-footer" role="status" aria-live="polite">
        {rows.length} of {records.length} synthetic application records
        <span> No real processor verification</span>
      </div>
    </div>
  );
}

export function LeadTable({ records = DEMO_LEADS }: { records?: readonly DemoLead[] }) {
  const [query, setQuery] = useState("");
  const rows = filterLeads(records, query);
  return (
    <div className="data-card">
      <div className="data-card-header">
        <div><h2>Lead directory</h2><p>Invented organizations and example.com contacts</p></div>
        <label className="search-box">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search fictional leads</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search fictional leads" />
        </label>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th scope="col">Company</th><th scope="col">Example contact</th><th scope="col">Internal stage</th><th scope="col">Owner</th></tr></thead>
          <tbody>
            {rows.map((lead) => (
              <tr key={lead.id}>
                <td><span className="primary-cell">{lead.organization}</span><span className="secondary-cell">{lead.id}</span></td>
                <td>{lead.contact}<span className="secondary-cell">{lead.email}</span></td>
                <td><span className={"status-pill stage-" + lead.stage}>{lead.stage}</span></td>
                <td>{lead.owner}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="empty-cell">No fictional leads match your search.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="data-card-footer" role="status" aria-live="polite">{rows.length} of {records.length} fictional leads</div>
    </div>
  );
}
