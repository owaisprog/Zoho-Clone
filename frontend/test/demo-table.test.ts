import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sortDemoRows, paginateDemoRows } from "../src/lib/demo-table";

describe("P3.11 demo table controls", () => {
  const rows = [{ name: "Demo 12", id: 1 }, { name: "Demo 2", id: 2 }, { name: "demo 2", id: 3 }];
  it("sorts naturally and stably without mutating input", () => {
    assert.deepEqual(sortDemoRows(rows, r => r.name).map(r => r.id), [2, 3, 1]);
    assert.deepEqual(sortDemoRows(rows, r => r.name, "desc").map(r => r.id), [1, 2, 3]);
    assert.equal(rows[0]?.id, 1);
  });
  it("paginates, clamps invalid pages, and handles empty tables", () => {
    assert.deepEqual(paginateDemoRows([1, 2, 3, 4, 5], 2, 2), {
      rows: [3, 4], page: 2, pageCount: 3, total: 5, hasPrevious: true, hasNext: true,
    });
    assert.deepEqual(paginateDemoRows([], -100, 2).rows, []);
    assert.equal(paginateDemoRows([1], 999, 2).page, 1);
    assert.throws(() => paginateDemoRows([1], 1, 0));
    assert.throws(() => paginateDemoRows([1], 1, 100));
  });
});