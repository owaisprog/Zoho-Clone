import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IDENTITY_DIAGNOSTIC_REASONS,
  identityUnavailableBody,
  classifyIdentityFetchFailure,
} from "../src/lib/identity-check-diagnostics";

describe("P3.13 safe local identity-check diagnostics", () => {
  it("returns fixed, non-sensitive diagnostic codes only in development", () => {
    for (const reason of IDENTITY_DIAGNOSTIC_REASONS) {
      assert.deepEqual(identityUnavailableBody(reason, "development"), {
        status: "backend_unavailable",
        diagnostic: reason,
      });
    }
  });

  it("does not disclose diagnostics in production or test", () => {
    for (const reason of IDENTITY_DIAGNOSTIC_REASONS) {
      assert.deepEqual(identityUnavailableBody(reason, "production"), {
        status: "backend_unavailable",
      });
      assert.deepEqual(identityUnavailableBody(reason, "test"), {
        status: "backend_unavailable",
      });
    }
  });

  it("distinguishes timeouts from other fetch failures without error details", () => {
    assert.equal(classifyIdentityFetchFailure({ name: "TimeoutError", message: "secret" }), "API_REQUEST_TIMED_OUT");
    assert.equal(classifyIdentityFetchFailure({ name: "AbortError", message: "secret" }), "API_REQUEST_TIMED_OUT");
    assert.equal(classifyIdentityFetchFailure(new Error("fetch failed: Bearer secret")), "API_CONNECTION_FAILED");
    assert.equal(classifyIdentityFetchFailure(null), "API_CONNECTION_FAILED");
    assert.equal(classifyIdentityFetchFailure({ name: "TypeError", cause: { token: "secret" } }), "API_CONNECTION_FAILED");
    const output = identityUnavailableBody(classifyIdentityFetchFailure({ name: "TimeoutError" }), "development");
    assert.deepEqual(output, { status: "backend_unavailable", diagnostic: "API_REQUEST_TIMED_OUT" });
    assert.deepEqual(
      identityUnavailableBody(classifyIdentityFetchFailure({ name: "TimeoutError" }), "production"),
      { status: "backend_unavailable" },
    );
  });

  it("never includes token values, issuer, audience or request metadata", () => {
    const serialized = JSON.stringify(identityUnavailableBody("AUTH0_TOKEN_REQUEST_FAILED", "development"));
    for (const prohibited of ["Bearer ", "AUTH0_CLIENT_SECRET", "https://", "eyJ", "example.com"]) {
      assert.equal(serialized.includes(prohibited), false);
    }
  });
});
