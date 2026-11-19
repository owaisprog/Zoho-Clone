import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isForbiddenTrackedPath,
  findHighConfidenceSecretIndicators,
} from "./check-tracked-secrets.mjs";

describe("P3.07 tracked-source secret guard", () => {
  it("accepts templates but rejects actual dotenv and private key file paths", () => {
    for (const good of [
      "backend/.env.example",
      "backend/.env.neon.example",
      "frontend/.env.auth0.example",
      "backend/db/schema.prisma",
    ]) assert.equal(isForbiddenTrackedPath(good), false, good);
    for (const bad of [
      ".env", "frontend/.env.local", "backend/.env.neon.local",
      "frontend/.env.production", "services/.env.staging",
      "private.pem", "aws-key.p12", "id_ed25519", "secrets/service-account-key.json",
    ]) assert.equal(isForbiddenTrackedPath(bad), true, bad);
  });

  it("finds high-confidence credentials without returning the matched value", () => {
    const samples = [
      ["ghp_" + "Q".repeat(36), "GITHUB_TOKEN"],
      ["github_pat_" + "A".repeat(80), "GITHUB_FINE_GRAINED_TOKEN"],
      ["AKIA" + "J".repeat(16), "AWS_ACCESS_KEY"],
      ["-----BEGIN " + "PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----", "PRIVATE_KEY"],
      ["postgresql://p3_neon_reader:UltraSecureFauxPassword2026@" +
        "ep-icy-water-9999.us-east-2.aws.neon.tech/zoho_clone_synthetic", "NEON_CONNECTION_CREDENTIAL"],
    ];
    for (const [value, expected] of samples) {
      const result = findHighConfidenceSecretIndicators(value);
      assert.ok(result.includes(expected), expected);
      assert.equal(result.join(",").includes(value), false);
    }
  });

  it("does not flag known sample connection strings or innocuous prose", () => {
    for (const sample of [
      "DATABASE_URL=postgresql://p3_neon_reader:REPLACE_WITH_PRIVATE_PASSWORD@" +
        "ep-example-pooler.us-east-2.aws.neon.tech/zoho_clone_synthetic?sslmode=verify-full",
      "AUTH0_SECRET=PASTE_64_HEX_CHARACTERS_HERE",
      "Do not commit credentials or passwords in your source code.",
    ]) assert.deepEqual(findHighConfidenceSecretIndicators(sample), []);
  });
});
