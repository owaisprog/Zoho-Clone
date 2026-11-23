import Link from "next/link";
import { ArrowLeft, ShieldAlert, ArrowRight } from "lucide-react";
import { P4MembershipInvitesPreview } from "@/components/p4-membership-invites-preview";

export default function FictionalMembershipsPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">P4.06–P4.10 / MEMBERSHIPS AND TENANCY</span>
          <h1>Organizations and invitations</h1>
          <p>Review how a user can have different roles in separate workspaces.</p>
        </div>
        <div className="action-row">
          <Link href="/app/settings" className="btn"><ArrowLeft size={16} aria-hidden="true"/> Settings</Link>
        </div>
      </div>
      <div className="demo-banner" role="note">
        <ShieldAlert size={18} aria-hidden="true" />
        <div>
          <strong>Fictional UX preview. No membership or invitation APIs are mounted.</strong>
          <span>Selections are in browser memory only. Live workspace access requires provider-verified identity, current server-side membership and PostgreSQL RLS checks.</span>
        </div>
      </div>
      <div className="p4-panel" style={{marginBottom:20}}>
        <h2>Try the working demo workflow</h2>
        <p>Create fictional organizations, switch workspaces, add pending invitations, simulate acceptance and revoke fictional memberships. All changes are in browser memory only.</p>
        <Link href="/app/organization/workflow" className="btn btn-primary">Open functional sandbox <ArrowRight size={16} aria-hidden="true"/></Link>
      </div>
      <P4MembershipInvitesPreview />
    </>
  );
}
