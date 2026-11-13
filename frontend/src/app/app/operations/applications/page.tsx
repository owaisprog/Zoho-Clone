import Link from "next/link";
import { ArrowLeft, CircleHelp, Plus } from "lucide-react";
import { ApplicationTable } from "@/components/record-tables";

export default function ApplicationsPage() {
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
          <strong>Internal demo only · external status unverified.</strong>
          <span>All five records are fictional. “Active internally” is not processing approval, real activation, charge capability, or a verified provider event.</span>
        </div>
      </div>
      <ApplicationTable />
    </>
  );
}
