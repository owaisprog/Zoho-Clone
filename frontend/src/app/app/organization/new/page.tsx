import Link from "next/link";
import { CircleHelp, ArrowLeft } from "lucide-react";
import { P4OrganizationWizardPreview } from "@/components/p4-organization-wizard-preview";

export default function FictionalOrganizationOnboardingPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">P4.05 / ORGANIZATION ONBOARDING</span>
          <h1>Create an organization · preview</h1>
          <p>Test the naming and slug layout using invented companies only.</p>
        </div>
        <div className="action-row">
          <Link href="/app/settings" className="btn"><ArrowLeft size={16} aria-hidden="true" /> Settings</Link>
        </div>
      </div>
      <div className="demo-banner" role="note">
        <CircleHelp size={18} aria-hidden="true" />
        <div>
          <strong>Preview-only. This form does not provision a tenant.</strong>
          <span>Real organization creation requires an authenticated, verified user, a transactional owner membership, database uniqueness and an approved tenant isolation gate.</span>
        </div>
      </div>
      <section className="p4-panel p4-panel-form" aria-label="Fictional organization wizard">
        <h2>Organization details</h2>
        <p>Draft values remain in this browser tab. No backend request occurs.</p>
        <P4OrganizationWizardPreview />
      </section>
    </>
  );
}
