import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { saveDemoLead, validateDemoDraft } from "../src/lib/demo-lead-draft";
import { DEMO_LEADS } from "../src/lib/synthetic-data";

const draft = {
  organization: "Demo Maple Ventures", contact: "Example Person C",
  email: "maple@example.com", stage: "new" as const,
};
describe("P3.06 fictional session-only lead creation and editing", () => {
  it("creates a local in-memory lead without mutating the initial fixture", () => {
    const count = DEMO_LEADS.length;
    const result = saveDemoLead(DEMO_LEADS, draft, null);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.id, "LEAD-DEMO-900");
    assert.equal(result.records.length, count + 1);
    assert.equal(result.records[count]?.owner, "Demo Sales");
    assert.equal(DEMO_LEADS.length, count);
    const next = saveDemoLead(result.records, draft, null);
    assert.equal(next.ok, true);
    if (next.ok) assert.equal(next.id, "LEAD-DEMO-901");
  });

  it("edits an existing demo record without changing its id or the source", () => {
    const result = saveDemoLead(DEMO_LEADS, {...draft,stage:"qualified"}, "LEAD-DEMO-101");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.records.length, DEMO_LEADS.length);
    assert.equal(result.records[0]?.id, "LEAD-DEMO-101");
    assert.equal(result.records[0]?.stage, "qualified");
    assert.notEqual(result.records[0], DEMO_LEADS[0]);
    assert.equal(DEMO_LEADS[0]?.organization, "Northstar Commerce Demo");
  });

  it("rejects real email addresses and names that are not clearly fictional", () => {
    assert.ok(validateDemoDraft({...draft, email:"manager@merchant.org"}).email);
    assert.ok(validateDemoDraft({...draft,organization:"Real Company"}).organization);
    assert.ok(validateDemoDraft({...draft,contact:"John Smith"}).contact);
    const result = saveDemoLead(DEMO_LEADS, {...draft,email:"client@gmail.com"}, null);
    assert.equal(result.ok, false);
  });

  it("rejects unknown edits and enforces the small in-memory demo limit", () => {
    assert.equal(saveDemoLead(DEMO_LEADS, draft, "LEAD-DEMO-999").ok, false);
    const many = Array.from({length:25}, (_,i)=>({...DEMO_LEADS[0]!,id:"LEAD-DEMO-"+(500+i)}));
    assert.equal(saveDemoLead(many, draft, null).ok, false);
  });
});
