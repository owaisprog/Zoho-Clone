"use client";

import { useState, type FormEvent } from "react";
import {
  fictionalOrganizationPreview, suggestFictionalSlug,
} from "@/lib/p4-organization-preview";

/**
 * This form never sends a request or stores an organization.
 * It is deliberately restricted to synthetic Demo names and slugs.
 */
export function P4OrganizationWizardPreview() {
  const [name, setName] = useState("Demo Maple Payments");
  const [slug, setSlug] = useState("demo-maple-payments");
  const [checked, setChecked] = useState(false);
  const draft = fictionalOrganizationPreview(name, slug);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChecked(true);
  }

  return (
    <form className="p4-form" onSubmit={submit}>
      <div className="p4-form-row">
        <label htmlFor="p4-org-name">Fictional organization name</label>
        <input
          id="p4-org-name"
          value={name}
          maxLength={64}
          autoComplete="off"
          onChange={event => {
            const next = event.target.value;
            setName(next);
            setSlug(suggestFictionalSlug(next));
            setChecked(false);
          }}
          required
        />
        <small>Must start with “Demo”. No real company information.</small>
      </div>
      <div className="p4-form-row">
        <label htmlFor="p4-org-slug">Workspace slug</label>
        <input
          id="p4-org-slug"
          value={slug}
          maxLength={48}
          autoComplete="off"
          onChange={event => { setSlug(event.target.value); setChecked(false); }}
          required
        />
        <small>Lowercase letters, digits and hyphens, beginning with demo-.</small>
      </div>
      <div className="p4-actions">
        <button type="submit" className="p4-button p4-button-primary">Validate fictional preview</button>
      </div>
      {checked && <div className="p4-alert" role="status" aria-live="polite">
        <strong>{draft.isValid ? "Fictional draft is valid" : "Please correct the draft"}</strong>
        <span>{draft.isValid
          ? "This is only a UI preview. No organization, slug reservation or owner membership has been saved."
          : "Use a fictional name beginning with Demo and a valid demo- slug. No data was submitted."}</span>
      </div>}
    </form>
  );
}
