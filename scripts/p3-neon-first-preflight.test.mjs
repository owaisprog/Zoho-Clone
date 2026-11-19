import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectDeveloperWorkspace } from "./p3-neon-first-preflight.mjs";

const files = ["package.json", "package-lock.json", "backend/package.json",
  "frontend/package.json", "backend/db/schema.prisma", "backend/.env.neon.example",
  "frontend/.env.auth0.example"];

function fixture(fn) {
  const root = mkdtempSync(join(tmpdir(), "p3-neon-preflight-"));
  try {
    for (const file of files) {
      mkdirSync(join(root, file, ".."), { recursive: true });
      writeFileSync(join(root, file), "fixture");
    }
    return fn(root);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

describe("P3.08 Neon-first local environment preflight", () => {
  it("allows synthetic CI with no live secrets and no local Docker", () => fixture(root => {
    const report = inspectDeveloperWorkspace(root, { ci: true, nodeMajor: 22 });
    assert.equal(report.ok, true);
    assert.equal(report.requiresLocalDocker, false);
    assert.equal(report.neonConfiguredLocally, false);
  }));
  it("requires private Neon local file for real developer preflight", () => fixture(root => {
    mkdirSync(join(root, "node_modules"));
    const fail = inspectDeveloperWorkspace(root, { nodeMajor: 22 });
    assert.equal(fail.ok, false);
    assert.deepEqual(fail.reasons, ["NEON_LOCAL_ENV_MISSING"]);
    writeFileSync(join(root, "backend/.env.neon.local"), "PRIVATE_FILE_CONTENT_NOT_READ");
    const pass = inspectDeveloperWorkspace(root, { nodeMajor: 22 });
    assert.equal(pass.ok, true);
    assert.equal(pass.neonConfiguredLocally, true);
  }));
  it("fails closed with old Node or missing repository files using fixed reasons", () => fixture(root => {
    const r = inspectDeveloperWorkspace(root, { ci: true, nodeMajor: 20 });
    assert.equal(r.ok, false);
    assert.deepEqual(r.reasons, ["NODE_22_REQUIRED"]);
  }));
});
