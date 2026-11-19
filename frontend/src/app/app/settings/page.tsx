import Link from "next/link";
import { BadgeCheck, Database, LockKeyhole, ShieldAlert, UsersRound } from "lucide-react";

const sections = [
  {
    title: "Organization context",
    body: "Only fictional Orchid Payments appears in this preview. Auth0 identity-only login is separate from membership and organization switching.",
    icon: Database,
  },
  {
    title: "Members and invitations",
    body: "P4 now includes a fictional membership and invitation preview. Owner roles are not universal CRM permissions; real invites and identity-to-tenant mapping are not enabled.",
    icon: UsersRound,
  },
  {
    title: "Permission policies",
    body: "Default-deny, tenant, row, field and export checks exist in approved P1 design documentation but not in this running UI.",
    icon: LockKeyhole,
  },
  {
    title: "Mock entitlements",
    body: "Subscription and billing remain design-only. No payment provider, customer charges, invoices or billing credentials.",
    icon: BadgeCheck,
  },
] as const;

export default function SettingsConceptPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">ORGANIZATION / PLANNED R0</span>
          <h1>Workspace settings</h1>
          <p>Safe read-only concept cards showing planned policy boundaries.</p>
        </div>
      </div>
      <div className="demo-banner" role="note">
        <ShieldAlert size={18} aria-hidden="true" />
        <div>
          <strong>No accounts, permissions, or subscriptions can be changed here.</strong>
          <span>Auth0 identity-only login exists, but this preview has no verified tenant permissions, organization writes, invitation service or payment connection. Do not use real data.</span>
        </div>
      </div>
      <div className="action-row" style={{ marginBottom: 18 }}>
        <Link className="btn" href="/account">Account and security</Link>
        <Link className="btn" href="/app/organization/new">Fictional organization preview</Link>
        <Link className="btn" href="/app/organization/memberships">Membership and invitation preview</Link>
      </div>
      <div className="settings-grid">
        {sections.map(({ title, body, icon: Icon }) => (
          <section className="setting-card" key={title}>
            <Icon size={22} aria-hidden="true" />
            <h2>{title}</h2>
            <p>{body}</p>
            <span className="state-note">Design only · not implemented</span>
          </section>
        ))}
      </div>
    </>
  );
}
