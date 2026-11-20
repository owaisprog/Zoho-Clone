"use client";

import { useState } from "react";
import Link from "next/link";
import {
  P4_OPERATIONS_FILE, P4_OPERATIONS_NOTICES,
  markFakeNoticeRead, simulateFakeClosure,
  type P4DemoNotice,
} from "@/lib/p4-operations-preview";

export function P4OperationsBatch05Preview() {
  const [notices, setNotices] = useState<readonly P4DemoNotice[]>(P4_OPERATIONS_NOTICES);
  const [noticeCategory, setNoticeCategory] = useState<"all" | "membership" | "task">("all");
  const [closureIntent, setClosureIntent] = useState<"export" | "closure">("export");
  const [simulateDependencies, setSimulateDependencies] = useState(false);
  const closure = simulateFakeClosure(closureIntent, simulateDependencies);
  const filtered = notices.filter(n => noticeCategory === "all" || n.category === noticeCategory);

  return (
    <div className="p4-platform-grid">
      <section className="p4-panel">
        <span className="p4-eyebrow">P4.21 · FILE DOWNLOAD & DELETION</span>
        <h2>Private file lifecycle</h2>
        <p>Metadata-only illustration. Permission loss must revoke access before any future private download grant.</p>
        <div className="p4-invite-info"><strong>{P4_OPERATIONS_FILE.label}</strong>
          <p>Version {P4_OPERATIONS_FILE.version} · {P4_OPERATIONS_FILE.state}</p>
        </div>
        <div className="p4-actions">
          <button className="p4-button" type="button" disabled>Preview / download unavailable</button>
          <button className="p4-button" type="button" disabled>Delete / restore unavailable</button>
        </div>
        <p className="p4-status-note">No signed URLs, public storage, file objects or deletion requests exist here.</p>
      </section>

      <section className="p4-panel">
        <span className="p4-eyebrow">P4.22 · NOTIFICATIONS</span>
        <h2>Fictional notification inbox</h2>
        <p>Recipient-only data model. Marking a notice read changes browser state only.</p>
        <div className="p4-form-row"><label htmlFor="p4-notice-filter">Notification category</label>
          <select id="p4-notice-filter" value={noticeCategory}
            onChange={e => setNoticeCategory(e.target.value as "all" | "membership" | "task")}>
            <option value="all">All</option><option value="membership">Memberships</option><option value="task">Tasks</option>
          </select></div>
        <div className="p4-audit-events" aria-label="Fictional notifications">
          {filtered.map(n => <div className="p4-audit-event" key={n.id}>
            <strong>{n.title}</strong><small>{n.read ? "Read in this browser" : "Unread"}</small>
            <div className="p4-actions"><Link className="text-link" href={n.link}>Open demo section</Link>
              <button className="p4-button" type="button" disabled={n.read}
                onClick={() => setNotices(current => markFakeNoticeRead(current, n.id))}>Mark read</button></div>
          </div>)}
        </div>
        <p className="p4-status-note">No provider email, background worker, persistence, or real user notifications.</p>
      </section>

      <section className="p4-panel">
        <span className="p4-eyebrow">P4.23 · PLATFORM ADMINISTRATION</span>
        <h2>Separate platform access</h2>
        <p>Tenant OWNER is not platform admin. Elevated issuer verification, independent platform grant and fresh MFA are required.</p>
        <div className="p4-alert" role="status"><strong>Platform actions unavailable</strong>
          <span>No platform business routes are mounted. Platform administrators cannot view tenant records from this preview.</span></div>
        <p className="p4-status-note">Fictional system metadata only; real monitoring and administrator audit are not connected.</p>
      </section>

      <section className="p4-panel">
        <span className="p4-eyebrow">P4.24 · CONTROLLED SUPPORT ACCESS</span>
        <h2>Support consent</h2>
        <p>Illustrative customer consent must have a verified organization owner, narrow scope and an expiring access window.</p>
        <div className="p4-invite-info"><strong>No active support sessions</strong>
          <p>Maximum proposed session: 30 minutes. Fresh consent: 15 minutes. Actual access remains disabled.</p>
        </div>
        <button type="button" className="p4-button" disabled>Request privileged session (disabled)</button>
        <p className="p4-status-note">No impersonation, tenant-record access, real customer consent, or persistent support grants.</p>
      </section>

      <section className="p4-panel">
        <span className="p4-eyebrow">P4.25 · ORGANIZATION DELETION / EXPORT</span>
        <h2>Closure readiness wizard</h2>
        <p>Illustrative only. A real request requires OWNER + recent step-up, billing reconciliation, export security and approved recovery.</p>
        <fieldset className="p4-form-row">
          <legend>Fictional request type</legend>
          <label><input type="radio" name="p4-closure" checked={closureIntent === "export"}
            onChange={() => setClosureIntent("export")} /> Export</label>
          <label><input type="radio" name="p4-closure" checked={closureIntent === "closure"}
            onChange={() => setClosureIntent("closure")} /> Closure</label>
        </fieldset>
        <label className="p4-form-row">
          <input type="checkbox" checked={simulateDependencies}
            onChange={e => setSimulateDependencies(e.target.checked)} />
          Simulate dependencies cleared (no server action)
        </label>
        <div className="p4-alert" role="status"><strong>{closure.label}</strong>
          <span>{closure.jobsCreated} export or deletion jobs created. No data can be removed here.</span></div>
        <p className="p4-status-note">The eventual deletion policy needs approved retention and rollback requirements.</p>
      </section>
    </div>
  );
}
