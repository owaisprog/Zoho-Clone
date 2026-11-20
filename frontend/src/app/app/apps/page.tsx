import Link from "next/link";
import { ArrowLeft, LayoutGrid } from "lucide-react";
import { P4AppLauncherPreview } from "@/components/p4-app-launcher-preview";
export default function FictionalAppsPage() {
  return (
    <>
      <div className="page-header">
        <div><span className="eyebrow">P4.17–18 / APPLICATIONS & NAVIGATION</span>
          <h1>App launcher</h1>
          <p>Preview available and locked applications using fictional entitlements.</p></div>
        <div className="action-row"><Link className="btn" href="/app/settings"><ArrowLeft size={16} aria-hidden="true"/> Settings</Link></div>
      </div>
      <div className="demo-banner" role="note">
        <LayoutGrid size={18} aria-hidden="true"/>
        <div><strong>Fictional launcher only. No commercial subscriptions.</strong>
          <span>Real access requires both entitlement and active permissions on each request. Links do not grant API access.</span></div>
      </div>
      <P4AppLauncherPreview />
    </>
  );
}
