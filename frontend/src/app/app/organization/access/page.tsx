import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { P4AccessPolicyPreview } from "@/components/p4-access-policy-preview";

export default function FictionalAccessPolicyPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">P4.11–P4.15 / SECURITY FOUNDATION</span>
          <h1>Roles, access and teams</h1>
          <p>Review reserved roles, record-level access, revocation, and fictional team visibility.</p>
        </div>
        <div className="action-row">
          <Link href="/app/settings" className="btn"><ArrowLeft size={16} aria-hidden="true"/> Settings</Link>
        </div>
      </div>
      <div className="demo-banner" role="note">
        <ShieldCheck size={18} aria-hidden="true" />
        <div>
          <strong>Fictional UI preview only. Not the production authorization engine.</strong>
          <span>Real access requires verified Auth0 identity, fresh organization membership, checked roles and attributes, and a non-owner PostgreSQL role with forced RLS.</span>
        </div>
      </div>
      <P4AccessPolicyPreview />
    </>
  );
}
