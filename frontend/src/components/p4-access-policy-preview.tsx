"use client";

import { useState } from "react";
import {
  FICTIONAL_ACCESS_MATRIX, fictionalActionPreview, visibleFictionalTeams,
  type FictionalAction, type FictionalRole,
} from "@/lib/p4-access-preview";

const permissionLabels: Readonly<{ code: FictionalAction; name: string }[]> = [
  { code: "org.members.read", name: "Read members" },
  { code: "org.members.manage", name: "Manage members" },
  { code: "crm.leads.read.own", name: "Read owned leads" },
  { code: "crm.leads.read.all", name: "Read leads in same organization" },
  { code: "teams.read.assigned", name: "Read assigned teams" },
  { code: "teams.manage.assigned", name: "Manage assigned team" },
];

export function P4AccessPolicyPreview() {
  const [role, setRole] = useState<FictionalRole>("MEMBER");
  const [memberActive, setMemberActive] = useState(true);
  const actorId = role === "OWNER" ? "user_demo_alice" : "user_demo_bob";
  const teamAssigned = true;
  const teamManager = true;
  const choices = visibleFictionalTeams(actorId, role, memberActive);
  const check = (permission: FictionalAction) =>
    fictionalActionPreview(role, permission, {
      sameOrg: true, ownsRecord: role === "OWNER", memberActive,
      teamAssigned, teamManager,
    });

  return (
    <div className="p4-access-grid">
      <section className="p4-panel">
        <span className="p4-eyebrow">P4.12 / P4.13 · ROLE & PERMISSION PREVIEW</span>
        <h2>Effective access matrix</h2>
        <p>Switch between two fictional membership roles. This matrix is an illustration, not a live API permission grant.</p>
        <div className="p4-access-role-picker" role="group" aria-label="Fictional role">
          {(["OWNER", "MEMBER"] as const).map(value => (
            <button key={value} type="button"
              className={"p4-workspace-choice" + (role === value ? " selected" : "")}
              aria-pressed={role === value}
              onClick={() => { setRole(value); setMemberActive(true); }}>
              <span><strong>{value === "OWNER" ? "Demo Alice (owner)" : "Demo Bob (member)"}</strong>
                <small>Role in Demo Orchid Payments only</small></span>
              <span className="p4-role">{value}</span>
            </button>
          ))}
        </div>
        <div className="p4-access-matrix" role="list" aria-label="Permissions for fictional actor">
          {permissionLabels.map(row => (
            <div className="p4-access-matrix-row" key={row.code} role="listitem">
              <span>{row.name}</span>
              <span className={"p4-policy-state " + (check(row.code) ? "allowed" : "denied")}>
                {check(row.code) ? "Preview allow" : "Preview deny"}
              </span>
            </div>
          ))}
        </div>
        <p className="p4-status-note">Listed template grants: {FICTIONAL_ACCESS_MATRIX[role].length}. Record and team conditions can still deny access.</p>
      </section>

      <section className="p4-panel">
        <span className="p4-eyebrow">P4.14 · ACCESS REVOCATION</span>
        <h2>Removal simulation</h2>
        <p>Simulate revoking this fictional member&apos;s organization membership. No real session, token, database or organization is changed.</p>
        <div className="p4-actions">
          <button className="p4-button" type="button" onClick={() => setMemberActive(x => !x)}>
            {memberActive ? "Simulate member revocation" : "Reset fictional membership"}
          </button>
        </div>
        <div className="p4-alert" role="status" aria-live="polite">
          <strong>{memberActive ? "Fictional membership active" : "Fictional membership revoked"}</strong>
          <span>{memberActive
            ? "Access is only illustrative. Production permission checks are not connected."
            : "All organization permissions and team visibility are now denied in this preview. Real Auth0 token revocation is not proven."}</span>
        </div>

        <div className="p4-invite-info">
          <span className="p4-eyebrow">P4.15 · DEPARTMENTS & TEAMS</span>
          <h2>Visible fictional teams</h2>
          {choices.length ? (
            <div className="p4-workspace-list">
              {choices.map(team => (
                <div className="p4-workspace-choice" key={team.id}>
                  <span><strong>{team.displayName}</strong><small>{team.departmentName}</small></span>
                  <span className="p4-role">{team.managerId === actorId ? "Manager" : "Owner view"}</span>
                </div>
              ))}
            </div>
          ) : <p className="p4-status-note">No teams visible to the selected fictional membership.</p>}
          <p>No team membership or manager assignment is saved by this page.</p>
        </div>
      </section>
    </div>
  );
}
