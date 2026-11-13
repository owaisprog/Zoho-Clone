import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getLeadPipeline, getDemoWorkload } from "../src/lib/demo-analytics";
import { DEMO_APPLICATIONS, DEMO_LEADS } from "../src/lib/synthetic-data";

describe("P3.05 dashboard and pipeline derived from demo data", () => {
  it("summarizes the current fictional datasets without fixed dashboard numbers", () => {
    assert.deepEqual(getDemoWorkload(DEMO_APPLICATIONS, DEMO_LEADS), {
      applications: 5, leads: 4, actions: 3, qualified: 1,
    });
    assert.deepEqual(getDemoWorkload([], []), { applications: 0, leads: 0, actions: 0, qualified: 0 });
  });
  it("calculates stage counts and percentages without mutating rows", () => {
    const before = JSON.stringify(DEMO_LEADS);
    assert.deepEqual(getLeadPipeline(DEMO_LEADS), [
      { stage: "new", label: "New", count: 2, percentage: 50 },
      { stage: "contacted", label: "Contacted", count: 1, percentage: 25 },
      { stage: "qualified", label: "Qualified", count: 1, percentage: 25 },
    ]);
    assert.equal(JSON.stringify(DEMO_LEADS), before);
    assert.deepEqual(getLeadPipeline([]).map((r) => r.percentage), [0,0,0]);
  });
});
