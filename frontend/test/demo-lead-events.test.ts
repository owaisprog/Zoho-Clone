import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appendDemoLeadEvent, eventsForDemoLead } from "../src/lib/demo-lead-events";

describe("P3.08 lead detail activity is generated-only and memory-only", () => {
  it("records non-sensitive fixed event descriptions per fictional lead", () => {
    let history = appendDemoLeadEvent([], "LEAD-DEMO-900", "created");
    history = appendDemoLeadEvent(history, "LEAD-DEMO-901", "edited");
    history = appendDemoLeadEvent(history, "LEAD-DEMO-900", "edited");
    assert.deepEqual(eventsForDemoLead(history, "LEAD-DEMO-900").map(x=>x.kind), ["edited", "created"]);
    assert.equal(history[0]?.description, "Fictional lead added in this session");
    assert.equal(history[2]?.id, "EVENT-DEMO-3");
  });
  it("never logs arbitrary IDs or exceeds bounded history", () => {
    assert.deepEqual(appendDemoLeadEvent([], "real-lead", "edited"), []);
    let history = appendDemoLeadEvent([], "LEAD-DEMO-900", "created");
    for (let i = 0; i < 40; i++) history = appendDemoLeadEvent(history, "LEAD-DEMO-900", "edited");
    assert.equal(history.length, 20);
    assert.equal(new Set(history.map(x => x.id)).size, 20);
  });
});