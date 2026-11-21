"use client";

import { useState, type FormEvent } from "react";
import {
  FICTIONAL_WORKSPACES, chooseFictionalWorkspace, normalizeFictionalInvite,
} from "@/lib/p4-membership-preview";

/**
 * No fetch() calls, no real invitations, no persisted organizations.
 * The role badges are FICTIONAL, not authorization for real CRM data.
 */
export function P4MembershipInvitesPreview() {
  const [selectedId, setSelectedId] = useState(FICTIONAL_WORKSPACES[0].orgId);
  const [recipientEmail, setRecipientEmail] = useState("new.member@example.com");
  const [validated, setValidated] = useState(false);
  const selected = chooseFictionalWorkspace(selectedId);
  const validEmail = selected ? normalizeFictionalInvite(recipientEmail, selected) : null;

  function validateInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidated(true);
  }

  return (
    <div className="p4-membership-layout">
      <section className="p4-panel">
        <span className="p4-eyebrow">P4.06 / P4.07 / P4.10</span>
        <h2>Fictional memberships</h2>
        <p>Choose a demo organization to preview its assigned role. Changing this selection does not change any backend tenant context.</p>
        <div className="p4-workspace-list" role="group" aria-label="Synthetic organization selection">
          {FICTIONAL_WORKSPACES.map(workspace => (
            <button
              key={workspace.orgId}
              type="button"
              className={"p4-workspace-choice" + (selectedId === workspace.orgId ? " selected" : "")}
              aria-pressed={selectedId === workspace.orgId}
              onClick={() => { setSelectedId(workspace.orgId); setValidated(false); }}
            >
              <span><strong>{workspace.displayName}</strong><small>Synthetic workspace</small></span>
              <span className="p4-role">{workspace.role}</span>
            </button>
          ))}
        </div>
        <div className="p4-alert" role="status">
          <strong>Selected for preview: {selected?.displayName ?? "None"}</strong>
          <span>Role: {selected?.role ?? "none"} · not stored in a cookie, URL, database, or request header</span>
        </div>
      </section>

      <section className="p4-panel">
        <span className="p4-eyebrow">P4.08 / P4.09</span>
        <h2>Invitation workflow preview</h2>
        <p>Real invitations require a verified owner, rate-limited email delivery and a single-use, expiring token. This form only checks a fictional draft.</p>
        <form className="p4-form" onSubmit={validateInvite}>
          <div className="p4-form-row">
            <label htmlFor="p4-invite-email">Demo recipient email</label>
            <input id="p4-invite-email" type="email" autoComplete="off"
              value={recipientEmail} onChange={event => { setRecipientEmail(event.target.value); setValidated(false); }}
              placeholder="demo@example.com" required />
            <small>Use an @example.com address. No email will be sent.</small>
          </div>
          <div className="p4-actions">
            <button className="p4-button p4-button-primary" type="submit">Validate draft only</button>
          </div>
          {validated &&
            <div className="p4-alert" role="status" aria-live="polite">
              <strong>{validEmail ? "Fictional invitation draft valid" : "Draft not allowed"}</strong>
              <span>{validEmail
                ? "This is a preview. Nothing was emailed, created, or added to a membership."
                : "Only the demo OWNER role can validate an example.com address. No action was performed."}</span>
            </div>}
        </form>
        <div className="p4-invite-info">
          <strong>Acceptance, resend and revocation</strong>
          <p>Real actions are disabled. The backend has isolated tests for hashed single-use tokens, expiration, resend rotation, revocation and rollback.</p>
        </div>
      </section>
    </div>
  );
}
