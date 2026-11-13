import Link from "next/link";
import { ArrowLeft, CircleHelp, Plus } from "lucide-react";
import { LeadTable } from "@/components/record-tables";
import { getDemoLeads } from "@/lib/demo-api";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const demo = await getDemoLeads();
  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">SALES CRM / LEADS</span>
          <h1>Leads</h1>
          <p>Fictional companies for reviewing tables and search. A local synthetic-only Express API can supply the rows. No real CRM database is connected.</p>
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
        <div><strong>Read-only synthetic CRM view.</strong><span>Source: {demo.source === "express-demo-api" ? "local Express fictional API" : "local fictional fallback"}. Search is client-side only. Authentication, tenant security, writes, imports and exports are not implemented.</span></div>
      </div>
      <LeadTable records={demo.records} />
    </>
  );
}
