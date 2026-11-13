import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEMO_TASKS } from "../src/lib/synthetic-data";
import { advanceDemoTask, filterDemoTasks, taskSummary } from "../src/lib/demo-task-actions";

describe("P3.10 synthetic task board", () => {
  it("advances fixed tasks in memory without modifying fixtures", () => {
    const first = advanceDemoTask(DEMO_TASKS, "TASK-DEMO-101");
    assert.equal(first.ok, true);
    assert.equal(first.records[0]?.status, "in_progress");
    assert.equal(DEMO_TASKS[0]?.status, "todo");
    const next = advanceDemoTask(first.records, "TASK-DEMO-101");
    assert.equal(next.records[0]?.status, "done");
    assert.equal(advanceDemoTask(next.records, "TASK-DEMO-101").ok, false);
  });
  it("does not accept real IDs or expose any mutation endpoint", () => {
    assert.equal(advanceDemoTask(DEMO_TASKS, "TASK-REAL-12").ok, false);
    assert.deepEqual(taskSummary(DEMO_TASKS), { total: 4, pending: 3, completed: 1 });
    assert.equal(filterDemoTasks(DEMO_TASKS, "APP-DEMO-102", "all").length, 1);
    assert.equal(filterDemoTasks(DEMO_TASKS, "", "todo").length, 2);
  });
});