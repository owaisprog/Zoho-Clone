import Link from "next/link";
import { ArrowLeft, CircleHelp, Plus } from "lucide-react";
import { LeadTable } from "@/components/record-tables";

export default function LeadsPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">SALES CRM / LEADS</span>
          <h1>Leads</h1>
          <p>Fictional companies for reviewing tables and search. No CRM API or database is connected.</p>
        </div>
        <div className="action-row">
          <Link href="/app" className="btn"><ArrowLeft size={15} aria-hidden="true" /> Overview</Link>
          <button type="button" className="btn btn-disabled" disabled title="Create lead is not implemented">
            <Plus size={15} aria-hidden="true" /> New lead · unavailable
          </button>
        </div>
      </div>
      <div className="demo-banner" role="note">
        <CircleHelp size={18} aria-hidden="true" />
        <div><strong>Read-only synthetic CRM view.</strong><span>Search changes only the displayed fictional array. Server-side authorization, tenant scoping, create/edit, imports and exports are not implemented.</span></div>
      </div>
      <LeadTable />
    </>
  );
}
