import Link from "next/link";
import { ArrowLeft, CircleHelp } from "lucide-react";
import { LeadWorkbench } from "@/components/lead-workbench";
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
        </div>
      </div>
      <div className="demo-banner" role="note">
        <CircleHelp size={18} aria-hidden="true" />
        <div><strong>Read-only synthetic CRM view.</strong><span>Source: {demo.source === "express-demo-api" ? "local Express fictional API" : "local fictional fallback"}. Search and in-browser create/edit are temporary fictional UI actions. Authentication, tenant security, API writes, imports and exports are not implemented.</span></div>
      </div>
      <LeadWorkbench initialRecords={demo.records} />
    </>
  );
}
