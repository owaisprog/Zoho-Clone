import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertApprovedBackendRuntimeEnvironment } from "../src/runtime-env.js";

const validAuth = {
  AUTH0_DOMAIN: "synthetic.us.auth0.com",
  AUTH0_AUDIENCE: "https://api.synthetic.example",
};

describe("P3.07 Express runtime environment contract", () => {
  it("allows minimal local/CI environment and valid identity-only Auth0", () => {
    assert.doesNotThrow(() => assertApprovedBackendRuntimeEnvironment({}));
    assert.doesNotThrow(() => assertApprovedBackendRuntimeEnvironment({ P3_APP_ENV: "ci" }));
    assert.doesNotThrow(() => assertApprovedBackendRuntimeEnvironment(validAuth));
  });

  it("blocks implicit staging and production deployment of the synthetic preview", () => {
    for (const profile of ["staging", "production", "prod", "external", ""]) {
      assert.throws(
        () => assertApprovedBackendRuntimeEnvironment({ P3_APP_ENV: profile }),
        /P3_RUNTIME_ENVIRONMENT_NOT_APPROVED/,
      );
    }
  });

  it("rejects partially configured Auth0 instead of silently turning identity checks off", () => {
    for (const sample of [
      { AUTH0_DOMAIN: validAuth.AUTH0_DOMAIN },
      { AUTH0_AUDIENCE: validAuth.AUTH0_AUDIENCE },
      { AUTH0_DOMAIN: "evil.invalid", AUTH0_AUDIENCE: validAuth.AUTH0_AUDIENCE },
      { AUTH0_DOMAIN: validAuth.AUTH0_DOMAIN, AUTH0_AUDIENCE: "not an identifier" },
    ]) {
      assert.throws(
        () => assertApprovedBackendRuntimeEnvironment(sample),
        /P3_AUTH0_CONFIGURATION_INVALID/,
      );
    }
  });

  it("refuses credentials in NEXT_PUBLIC variables without exposing their content", () => {
    const secret = "NEVER_PRINT_OR_SHARE_THIS_SECRET";
    for (const key of ["NEXT_PUBLIC_AUTH0_SECRET", "NEXT_PUBLIC_DATABASE_URL", "NEXT_PUBLIC_API_KEY"]) {
      assert.throws(
        () => assertApprovedBackendRuntimeEnvironment({ [key]: secret }),
        (error: unknown) =>
          error instanceof Error &&
          error.message === "P3_PUBLIC_SECRET_ENVIRONMENT_FORBIDDEN" &&
          !error.message.includes(secret),
      );
    }
  });
});
