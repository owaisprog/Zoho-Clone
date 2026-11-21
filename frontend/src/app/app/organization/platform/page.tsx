import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { P4OrganizationPreferencesPreview, P4AuditPreview, P4FileUploadPreview } from "@/components/p4-platform-controls-preview";
export default function PlatformControlsPage() {
  return (
    <>
      <div className="page-header">
        <div><span className="eyebrow">P4.16 / P4.19 / P4.20 · PLATFORM CONTROLS</span>
          <h1>Preferences, audit and files</h1>
          <p>Explore fictional settings and audit entries while private uploads remain disabled.</p></div>
        <div className="action-row"><Link href="/app/settings" className="btn">
          <ArrowLeft size={16} aria-hidden="true"/> Settings</Link></div>
      </div>
      <div className="demo-banner" role="note"><ShieldCheck size={18} aria-hidden="true"/>
        <div><strong>Fictional platform preview only</strong>
          <span>There are no real settings writes, audit exports, file uploads or attachment download URLs. Access must be verified server-side before release.</span></div>
      </div>
      <div className="p4-platform-grid">
        <P4OrganizationPreferencesPreview/>
        <P4AuditPreview/>
        <P4FileUploadPreview/>
      </div>
    </>
  );
}
