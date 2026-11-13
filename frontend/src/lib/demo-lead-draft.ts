import type { DemoLead, LeadStage } from "@zoho-clone/demo-contracts";

export interface DemoLeadDraft {
  organization: string;
  contact: string;
  email: string;
  stage: LeadStage;
}
export type DraftErrors = Partial<Record<keyof DemoLeadDraft | "form", string>>;
export type SaveResult = { ok: true; records: DemoLead[]; id: string } | { ok: false; errors: DraftErrors };

// These rules deliberately prevent accidental entry of genuine customer
// contact details into a PUBLIC, ephemeral training/demo screen.
export function validateDemoDraft(draft: DemoLeadDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (!/^(Demo [A-Za-z][A-Za-z0-9 &.'-]{1,70}|[A-Za-z][A-Za-z0-9 &.'-]{1,70} Demo)$/.test(draft.organization.trim())) {
    errors.organization = "Use an invented company name beginning or ending with 'Demo'.";
  }
  if (!/^Example [A-Za-z][A-Za-z .'-]{1,60}$/.test(draft.contact.trim())) {
    errors.contact = "Use an invented contact beginning with 'Example '.";
  }
  if (!/^[a-z0-9][a-z0-9.-]{0,45}@example\.com$/.test(draft.email.trim().toLowerCase())) {
    errors.email = "Only fictional example.com addresses are allowed.";
  }
  if (!["new", "contacted", "qualified"].includes(draft.stage)) {
    errors.stage = "Select a valid internal demo stage.";
  }
  return errors;
}

export function saveDemoLead(
  existing: readonly DemoLead[], draft: DemoLeadDraft, editingId: string | null,
): SaveResult {
  const errors = validateDemoDraft(draft);
  if (Object.keys(errors).length) return { ok: false, errors };

  const sanitized: Omit<DemoLead,"id"> = {
    organization: draft.organization.trim(),
    contact: draft.contact.trim(),
    email: draft.email.trim().toLowerCase(),
    stage: draft.stage,
    owner: "Demo Sales",
  };

  if (editingId) {
    const target = existing.find((row) => row.id === editingId);
    if (!target) return { ok: false, errors: { form: "This fictional lead is no longer in the demo list." } };
    return {
      ok: true, id: editingId,
      records: existing.map((row) => row.id === editingId ? { id: editingId, ...sanitized } : { ...row }),
    };
  }

  if (existing.length >= 25) {
    return { ok: false, errors: { form: "The in-browser demo is limited to 25 fictional leads." } };
  }
  const used = new Set(existing.map((row) => row.id));
  let next = 900;
  while (used.has("LEAD-DEMO-" + next) && next < 999) next++;
  if (next >= 999 && used.has("LEAD-DEMO-999")) {
    return { ok: false, errors: { form: "No fictional demo identifiers remain." } };
  }
  const id = "LEAD-DEMO-" + next;
  return { ok: true, id, records: [...existing.map((row) => ({ ...row })), { id, ...sanitized }] };
}
