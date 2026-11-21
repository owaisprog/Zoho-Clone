"use client";
import { useState } from "react";
import { p4DemoAuditFilter, p4DemoEffectiveTimeZone, P4_FAKE_SETTINGS,
  type P4DemoAuditKind } from "@/lib/p4-platform-preview";

export function P4OrganizationPreferencesPreview() {
  const [zone, setZone] = useState("Asia/Karachi");
  const [userZone, setUserZone] = useState("");
  return (
    <section className="p4-panel">
      <span className="p4-eyebrow">P4.16 · ORGANIZATION PREFERENCES</span>
      <h2>Fictional workspace settings</h2>
      <p>Changes only affect this browser preview. No organization or billing settings are saved.</p>
      <div className="p4-form">
        <div className="p4-form-row"><label htmlFor="p4-preferences-name">Organization</label>
          <input id="p4-preferences-name" type="text" value={P4_FAKE_SETTINGS.name} readOnly /></div>
        <div className="p4-form-row"><label htmlFor="p4-preferences-currency">Display currency</label>
          <input id="p4-preferences-currency" type="text" value={P4_FAKE_SETTINGS.currency} readOnly />
          <small>No payment, subscription or invoice currency is being changed.</small></div>
        <div className="p4-form-row"><label htmlFor="p4-preferences-zone">Fictional organization timezone</label>
          <select id="p4-preferences-zone" value={zone} onChange={e => setZone(e.target.value)}>
            <option value="Asia/Karachi">Asia/Karachi</option><option value="UTC">UTC</option>
            <option value="America/New_York">America/New_York</option>
          </select></div>
        <div className="p4-form-row"><label htmlFor="p4-preferences-user-zone">Fictional user timezone override</label>
          <select id="p4-preferences-user-zone" value={userZone} onChange={e => setUserZone(e.target.value)}>
            <option value="">Use organization default</option><option value="Europe/London">Europe/London</option>
            <option value="Asia/Karachi">Asia/Karachi</option>
          </select></div>
      </div>
      <div className="p4-alert" role="status"><strong>Effective timezone: {p4DemoEffectiveTimeZone(userZone, zone)}</strong>
        <span>Browser-only preview. Nothing was written to the server.</span></div>
    </section>
  );
}
export function P4AuditPreview() {
  const [filter, setFilter] = useState<"all" | P4DemoAuditKind>("all");
  const events = p4DemoAuditFilter(filter);
  return (
    <section className="p4-panel">
      <span className="p4-eyebrow">P4.19 · AUDIT LOG</span>
      <h2>Fictional audit trail</h2>
      <p>Illustrative entries only. A real audit log needs append-only storage, retention and admin/auditor access.</p>
      <div className="p4-form-row"><label htmlFor="p4-audit-filter">Event filter</label>
        <select id="p4-audit-filter" value={filter}
          onChange={e => setFilter(e.target.value as "all" | P4DemoAuditKind)}>
          <option value="all">All events</option><option value="team.created">Team created</option>
          <option value="membership.revoked">Membership revoked</option>
          <option value="org.preferences.changed">Preferences updated</option>
        </select></div>
      <div className="p4-audit-events" aria-label="Fictional read-only audit events">
        {events.map(e => <div className="p4-audit-event" key={e.id}>
          <strong>{e.event}</strong><small>{e.date} · {e.actor}</small>
          <small>Before: {e.before} · After: {e.after}</small>
        </div>)}
      </div>
      <p className="p4-status-note">Read-only demo. Real records cannot be edited from this page.</p>
    </section>
  );
}
export function P4FileUploadPreview() {
  return (
    <section className="p4-panel">
      <span className="p4-eyebrow">P4.20 · FILE UPLOAD SERVICE</span>
      <h2>Private attachments</h2>
      <p>Upload is disabled until a private provider, record authorization, signed grants, file quarantine and malware scanning are approved.</p>
      <div className="p4-form-row"><label htmlFor="p4-disabled-upload">Choose a document (disabled)</label>
        <input id="p4-disabled-upload" type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" disabled
          aria-describedby="p4-upload-disabled-reason" />
        <small id="p4-upload-disabled-reason">Do not enter real client files. No file can be selected or uploaded.</small></div>
      <div className="p4-alert" role="status"><strong>Private upload not configured</strong>
        <span>No file objects, signed URLs, attachments or upload progress exist yet.</span></div>
      <div className="p4-invite-info"><strong>Attachment list</strong>
        <p>No uploaded attachments. A real file will remain quarantined until scanning and record permissions pass.</p></div>
    </section>
  );
}
