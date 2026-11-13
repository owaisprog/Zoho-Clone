import { BadgeCheck, Database, LockKeyhole, ShieldAlert, UsersRound } from "lucide-react";

const sections = [
  {
    title: "Organization context",
    body: "Only Orchid Payments Demo appears in this preview. Active membership and organization switching are future R0 features.",
    icon: Database,
  },
  {
    title: "Members and invitations",
    body: "Owner/admin roles are not universal sales or merchant data grants. Real identity and invitations remain unimplemented.",
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
          <span>This preview has no login, server-side tenant guards, database, invite links or payment connections. Do not use it with real data.</span>
        </div>
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
