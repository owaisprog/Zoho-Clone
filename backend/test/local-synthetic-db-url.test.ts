import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { requireLocalSyntheticDatabaseUrl } from "../src/internal/local-synthetic-db-url.js";

const safe = "postgresql://p3_preview_runtime:fake_p3_preview_only@127.0.0.1:5433/zoho_clone_synthetic";
describe("P3.05 strictly local, read-only Prisma connection guard", () => {
  it("accepts only local fictional test database using restricted role", () => {
    assert.equal(requireLocalSyntheticDatabaseUrl(safe), safe);
    assert.equal(requireLocalSyntheticDatabaseUrl(safe + "?schema=synthetic"), safe + "?schema=synthetic");
  });
  it("fails closed for missing or malformed database URLs", () => {
    assert.throws(() => requireLocalSyntheticDatabaseUrl(undefined), /LOCAL_SYNTHETIC_DATABASE_URL_REQUIRED/);
    assert.throws(() => requireLocalSyntheticDatabaseUrl("not a URL"), /LOCAL_SYNTHETIC_DATABASE_URL_INVALID/);
  });
  it("blocks remote/cloud/privileged/other-database connections", () => {
    for (const url of [
      "postgresql://p3_preview_runtime:fake@localhost:5433/zoho_clone_synthetic",
      "postgresql://p3_preview_runtime:fake@127.0.0.1:5432/zoho_clone_synthetic",
      "postgresql://demo_local:fake@127.0.0.1:5433/zoho_clone_synthetic",
      "postgresql://p3_preview_runtime:fake@db.example.com:5433/zoho_clone_synthetic",
      "postgresql://p3_preview_runtime:fake@127.0.0.1:5433/real_customer",
      "postgres://p3_preview_runtime:fake@127.0.0.1:5433/zoho_clone_synthetic",
      "postgresql://p3_preview_runtime:fake@127.0.0.1:5433/zoho_clone_synthetic?sslmode=disable",
      "postgresql://p3_preview_runtime:fake@127.0.0.1:5433/zoho_clone_synthetic#secret",
      "postgresql://p3_preview_runtime@127.0.0.1:5433/zoho_clone_synthetic",
    ]) {
      assert.throws(() => requireLocalSyntheticDatabaseUrl(url), /LOCAL_SYNTHETIC_DATABASE_URL_REJECTED/);
    }
  });
});
