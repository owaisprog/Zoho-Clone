import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { P4OperationsBatch05Preview } from "@/components/p4-operations-batch05-preview";

export default function P4ContinuityPage() {
  return (
    <>
      <div className="page-header">
        <div><span className="eyebrow">P4.21–P4.25 · SECURE PLATFORM FOUNDATION</span>
          <h1>File access, notifications & organization safety</h1>
          <p>Explore the next five fictional platform controls without enabling privileged endpoints.</p></div>
        <div className="action-row"><Link className="btn" href="/app/organization/platform">
          <ArrowLeft size={16} aria-hidden="true"/> Platform controls</Link></div>
      </div>
      <div className="demo-banner" role="note"><ShieldCheck size={18} aria-hidden="true"/>
        <div><strong>Safe synthetic preview, not a production service</strong>
          <span>All privileged platform operations, file downloads, support access and deletion/export jobs are disabled. No real records or external emails.</span></div>
      </div>
      <P4OperationsBatch05Preview/>
    </>
  );
}
