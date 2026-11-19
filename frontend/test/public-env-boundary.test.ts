import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertNoPublicSecretEnvironment } from "../src/lib/public-env-boundary";

describe("P3.07 Next.js public environment boundary", () => {
  it("accepts a small private-only local environment", () => {
    assert.doesNotThrow(() => assertNoPublicSecretEnvironment({
      AUTH0_CLIENT_SECRET: "fake-private-test-value",
      AUTH0_SECRET: "0".repeat(64),
      API_INTERNAL_URL: "http://127.0.0.1:4000",
      NEXT_PUBLIC_APP_LABEL: "Zoho Clone Synthetic Preview",
    }));
  });
  it("rejects public-prefixed secret names, returning a constant safe message", () => {
    for (const name of [
      "NEXT_PUBLIC_AUTH0_CLIENT_SECRET",
      "NEXT_PUBLIC_AUTH0_SECRET",
      "NEXT_PUBLIC_DATABASE_URL",
      "NEXT_PUBLIC_API_KEY",
      "NEXT_PUBLIC_ACCESS_TOKEN",
      "NEXT_PUBLIC_ACCOUNT_PASSWORD",
      "NEXT_PUBLIC_PRIVATE_KEY",
    ]) {
      const sensitive = "SECRET_NOT_TO_BE_LOGGED";
      assert.throws(
        () => assertNoPublicSecretEnvironment({ [name]: sensitive }),
        (error: unknown) => error instanceof Error &&
          error.message === "P3_PUBLIC_SECRET_ENVIRONMENT_FORBIDDEN" &&
          !error.message.includes(sensitive),
      );
    }
  });
});
