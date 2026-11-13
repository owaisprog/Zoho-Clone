import Link from "next/link";
import { ArrowLeft, CircleHelp, Plus } from "lucide-react";
import { ApplicationWorkbench } from "@/components/application-workbench";
import { getDemoApplications } from "@/lib/demo-api";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const demo = await getDemoApplications();
  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">MERCHANT OPERATIONS / INTERNAL QUEUE</span>
          <h1>Merchant applications</h1>
          <p>Owner, internal stage and next action. This is not actual underwriting or processor boarding.</p>
        </div>
        <div className="action-row">
          <Link href="/app" className="btn"><ArrowLeft size={15} aria-hidden="true" /> Overview</Link>
          <button type="button" className="btn btn-disabled" disabled title="Create application is not implemented">
            <Plus size={15} aria-hidden="true" /> New application · unavailable
          </button>
        </div>
      </div>
      <div className="demo-banner" role="note">
        <CircleHelp size={18} aria-hidden="true" />
        <div>
          <strong>Internal demo only · temporary browser changes · external status unverified.</strong>
          <span>All five records are fictional. Source: {demo.source === "express-demo-api" ? "local Express fictional API" : "local fictional fallback"}. “Active internally” is not processor approval or live payment capability.</span>
        </div>
      </div>
      <ApplicationWorkbench initialRecords={demo.records} />
    </>
  );
}
