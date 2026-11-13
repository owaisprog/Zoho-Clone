import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ATTENTION_STAGES,
  DEMO_APPLICATIONS,
  DEMO_LEADS,
  DEMO_TASKS,
  DEMO_ORGANIZATION,
  STAGE_LABELS,
  filterApplications,
  filterLeads,
  getApplicationSummary,
} from "../src/lib/synthetic-data";

describe("P3.01 synthetic-only frontend data", () => {
  it("uses a fictional organization and unique, nonempty demo identifiers", () => {
    assert.match(DEMO_ORGANIZATION.id, /^org_demo_/);
    assert.ok(DEMO_ORGANIZATION.name.includes("Demo"));

    const applications = DEMO_APPLICATIONS.map((record) => record.id);
    const leads = DEMO_LEADS.map((record) => record.id);
    assert.equal(new Set(applications).size, DEMO_APPLICATIONS.length);
    assert.equal(new Set(leads).size, DEMO_LEADS.length);
    assert.ok(applications.every((id) => id.startsWith("APP-DEMO-")));
    assert.ok(leads.every((id) => id.startsWith("LEAD-DEMO-")));
  });

  it("keeps sample contact addresses under example.com", () => {
    for (const lead of DEMO_LEADS) {
      assert.ok(lead.email.endsWith("@example.com"), lead.email);
    }
  });

  it("computes the internal queue totals from fictional rows", () => {
    assert.deepEqual(getApplicationSummary(DEMO_APPLICATIONS), {
      total: 5,
      needsAttention: 3,
      internalActive: 1,
    });
    assert.deepEqual(getApplicationSummary([]), {
      total: 0,
      needsAttention: 0,
      internalActive: 0,
    });
  });

  it("has a distinct non-provider-verified label for every internal stage", () => {
    const stages = new Set(DEMO_APPLICATIONS.map((row) => row.stage));
    for (const stage of stages) {
      assert.ok(STAGE_LABELS[stage]);
      assert.ok(!/processor approved|charges enabled|payout live/i.test(STAGE_LABELS[stage]));
    }
    assert.ok(ATTENTION_STAGES.includes("waiting_demo"));
    assert.ok(!ATTENTION_STAGES.includes("active_internal"));
  });

  it("filters application rows case-insensitively and never mutates the fixture", () => {
    const originalLength = DEMO_APPLICATIONS.length;
    assert.deepEqual(
      filterApplications(DEMO_APPLICATIONS, "PiNe").map((record) => record.id),
      ["APP-DEMO-102"],
    );
    assert.deepEqual(
      filterApplications(DEMO_APPLICATIONS, "INTERNAL HANDOFF").map((record) => record.id),
      ["APP-DEMO-104"],
    );
    assert.equal(filterApplications(DEMO_APPLICATIONS, "no matching merchant").length, 0);
    assert.equal(filterApplications(DEMO_APPLICATIONS, "").length, originalLength);
    assert.equal(DEMO_APPLICATIONS.length, originalLength);
  });

  it("filters leads without relying on an API or real customer data", () => {
    assert.deepEqual(
      filterLeads(DEMO_LEADS, "contact-b@example.com").map((row) => row.id),
      ["LEAD-DEMO-102"],
    );
    assert.equal(filterLeads(DEMO_LEADS, "non-existent").length, 0);
    assert.equal(filterLeads(DEMO_LEADS, " ").length, DEMO_LEADS.length);
  });

  it("uses fictional task IDs and references only existing fictional records", () => {
    const ids = new Set([...DEMO_LEADS.map(x=>x.id), ...DEMO_APPLICATIONS.map(x=>x.id)]);
    assert.equal(new Set(DEMO_TASKS.map(x=>x.id)).size, DEMO_TASKS.length);
    assert.ok(DEMO_TASKS.every(task => task.title.startsWith("Demo ") && ids.has(task.relatedId)));
    assert.ok(DEMO_TASKS.every(task => task.dueLabel.startsWith("Demo day ")));
  });
});
