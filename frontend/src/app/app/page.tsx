import Link from "next/link";
import {
  Activity, ArrowRight, ArrowUpRight, ClipboardCheck, Clock3, Database, Server,
} from "lucide-react";
import { getBackendStatus } from "@/lib/backend-status";
import { getDemoApplications, getDemoLeads } from "@/lib/demo-api";
import {
  getApplicationSummary,
} from "@/lib/synthetic-data";

export const dynamic = "force-dynamic";

export default async function WorkspaceHome() {
  const [applications, leads, api] = await Promise.all([
    getDemoApplications(), getDemoLeads(), getBackendStatus(),
  ]);
  const summary = getApplicationSummary(applications.records);

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">DEMO WORKSPACE / OVERVIEW</span>
          <h1>Good to have you here.</h1>
          <p>One place to understand internal cases, ownership and the next action.</p>
        </div>
        <div className="action-row">
          <Link href="/app/operations/applications" className="btn btn-primary">
            View demo queue <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="demo-banner" role="note">
        <Database size={18} aria-hidden="true" />
        <div>
          <strong>All records are fictional, from local Express or fallback fixtures.</strong>
          <span>No tenant authentication, database, processor onboarding, paid billing, or real merchant records are connected. Navigation is illustrative, not permission enforcement.</span>
        </div>
      </div>

      <section className="metrics-grid" aria-label="Fictional operational metrics">
        <div className="metric-card">
          <div className="metric-title"><span>Demo applications</span><span className="metric-icon"><ClipboardCheck size={17} aria-hidden="true" /></span></div>
          <div className="metric-value">{summary.total}</div>
          <div className="metric-note">Synthetic onboarding cases</div>
        </div>
        <div className="metric-card">
          <div className="metric-title"><span>Needs next action</span><span className="metric-icon"><Clock3 size={17} aria-hidden="true" /></span></div>
          <div className="metric-value">{summary.needsAttention}</div>
          <div className="metric-note">Not verified processor statuses</div>
        </div>
        <div className="metric-card">
          <div className="metric-title"><span>Backend process</span><span className="metric-icon"><Server size={17} aria-hidden="true" /></span></div>
          <div className="metric-value small-text">{api.online ? "Running locally" : "Not connected"}</div>
          <div className="metric-note">{api.label} · health only, not auth/DB readiness</div>
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-title-row">
            <div><h2>Internal work queue</h2><p>Safe synthetic records requiring a human next step</p></div>
            <Link href="/app/operations/applications" className="text-link">Open queue <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
          {applications.records.filter((record) => record.stage !== "active_internal").slice(0, 4).map((record) => (
            <div className="work-item" key={record.id}>
              <span className="work-item-icon"><Activity size={17} aria-hidden="true" /></span>
              <div className="work-item-main">
                <strong>{record.name}</strong>
                <small>{record.nextAction} · {record.owner}</small>
              </div>
              <span className="status-pill stage-waiting_demo">Demo</span>
            </div>
          ))}
        </section>
        <section className="panel">
          <div className="panel-title-row">
            <div><h2>Applications</h2><p>Original modular workspace direction</p></div>
          </div>
          <div className="module-card">
            <strong>Sales CRM</strong>
            <span>{leads.records.length} fictional leads available for UI review</span>
            <Link href="/app/sales/leads" className="text-link">Review leads <ArrowRight size={13} aria-hidden="true" /></Link>
          </div>
          <div className="module-card">
            <strong>Merchant Operations</strong>
            <span>Internal queue and demo status labels only</span>
            <Link href="/app/operations/applications" className="text-link">Review applications <ArrowRight size={13} aria-hidden="true" /></Link>
          </div>
          <div className="module-card">
            <strong>Future modules</strong>
            <span>Agent portal, processors, billing and KYC are not implemented</span>
          </div>
        </section>
      </div>
    </>
  );
}
