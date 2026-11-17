import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { requireNeonSyntheticDatabaseUrl } from "../src/internal/neon-synthetic-db-url.js";

const good = "postgresql://p3_neon_reader:long-fake-test-password@ep-example-pooler.us-east-2.aws.neon.tech/zoho_clone_synthetic?sslmode=require";

describe("P3.05 restricted Neon development Postgres connection guard", () => {
  it("only accepts Neon PostgreSQL endpoint with synthetic DB, read-only role and TLS", () => {
    assert.equal(requireNeonSyntheticDatabaseUrl(good), good);
    const extra = good + "&channel_binding=require";
    assert.equal(requireNeonSyntheticDatabaseUrl(extra), extra);
    const direct = good.replace("-pooler.", ".");
    assert.equal(requireNeonSyntheticDatabaseUrl(direct), direct);
  });
  it("rejects absent or malformed URLs", () => {
    assert.throws(() => requireNeonSyntheticDatabaseUrl(undefined), /REQUIRED/);
    assert.throws(() => requireNeonSyntheticDatabaseUrl("not-url"), /INVALID/);
  });
  it("denies privileged, remote non-Neon, non-synthetic, weak TLS and injected values", () => {
    for (const url of [
      good.replace("p3_neon_reader", "neondb_owner"),
      good.replace("zoho_clone_synthetic", "neondb"),
      good.replace(".neon.tech", ".example.com"),
      good.replace("ep-example-pooler.", "other-host."),
      good.replace("sslmode=require", "sslmode=disable"),
      good.replace("?sslmode=require", ""),
      good.replace("sslmode=require", "sslmode=prefer"),
      good.replace("5432", "5444").replace("neon.tech", "neon.tech:5444"),
      good.replace("long-fake-test-password", "weak"),
      good + "&options=-c%20search_path%3Dpublic",
      good + "#private",
      good.replace("postgresql:", "http:"),
      good.replace("ep-example-pooler.us-east-2.aws.neon.tech", "127.0.0.1"),
    ]) {
      assert.throws(() => requireNeonSyntheticDatabaseUrl(url), /REJECTED/, url);
    }
  });
});
