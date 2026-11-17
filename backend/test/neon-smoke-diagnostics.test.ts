import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyNeonSmokeFailure } from "../src/internal/neon-smoke-diagnostics.js";

describe("P3.05 Neon smoke reports secret-free diagnostic codes", () => {
  it("classifies missing or invalid private env without echoing it", () => {
    for (const suffix of ["REQUIRED", "INVALID", "REJECTED"]) {
      const error = new Error("NEON_SYNTHETIC_DATABASE_URL_" + suffix);
      assert.equal(classifyNeonSmokeFailure(error), "NEON_ENVIRONMENT_MISSING_OR_INVALID");
    }
  });
  it("classifies network, database and authentication error codes", () => {
    const cases: readonly [unknown, string][] = [
      [{ code: "P1000" }, "NEON_ROLE_AUTHENTICATION_FAILED"],
      [{ code: "P1003" }, "NEON_DATABASE_NOT_FOUND"],
      [{ code: "P1001" }, "NEON_ENDPOINT_UNREACHABLE"],
      [{ code: "P1002" }, "NEON_ENDPOINT_UNREACHABLE"],
      [{ code: "P1010" }, "NEON_ROLE_PERMISSION_DENIED"],
      [{ code: "P2021" }, "NEON_SYNTHETIC_SCHEMA_MISSING"],
      [{ meta: { code: "42P01" } }, "NEON_SYNTHETIC_SCHEMA_MISSING"],
      [{ cause: { code: "28P01" } }, "NEON_ROLE_AUTHENTICATION_FAILED"],
      [{ cause: { code: "ENOTFOUND" } }, "NEON_ENDPOINT_UNREACHABLE"],
      [{ code: "42501" }, "NEON_ROLE_PERMISSION_DENIED"],
      [{ code: "3D000" }, "NEON_DATABASE_NOT_FOUND"],
    ];
    for (const [error, expected] of cases) {
      assert.equal(classifyNeonSmokeFailure(error), expected);
    }
  });
  it("redacts unexpected failures and never returns attacker-controlled text", () => {
    const secretUrl = "postgresql://user:secret@ep-host.neon.tech/zoho_clone_synthetic";
    for (const error of [
      { code: "UNKNOWN", message: secretUrl },
      { name: "AssertionError", message: secretUrl },
      { cause: { code: "OTHER", message: secretUrl } },
      secretUrl,
      null,
    ]) {
      const diagnostic = classifyNeonSmokeFailure(error);
      assert.match(diagnostic, /^NEON_[A-Z_]+$/);
      assert.equal(diagnostic.includes("secret"), false);
      assert.equal(diagnostic.includes("postgres"), false);
    }
  });
});
