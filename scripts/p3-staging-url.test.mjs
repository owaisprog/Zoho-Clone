import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { requireApprovedStagingUrl } from "./p3-staging-url.mjs";

describe("P3.10 staging endpoint URL gate", () => {
  it("accepts explicit HTTPS staging/preview domains only", () => {
    assert.equal(requireApprovedStagingUrl("https://staging.zoho-clone.test"), "https://staging.zoho-clone.test");
    assert.equal(requireApprovedStagingUrl("https://zoho-clone-preview.vercel.app/"), "https://zoho-clone-preview.vercel.app");
  });
  it("rejects production, local, credentials, fragments, queries and nonstandard ports", () => {
    const bad = [
      "", "https://zoho-clone.com", "https://production.zoho-clone.com",
      "http://staging.zoho-clone.com", "https://localhost",
      "https://staging.zoho-clone.example.com",
      "https://staging.zoho-clone.local",
      "https://user:secret@staging.zoho-clone.com",
      "https://staging.zoho-clone.com:8443",
      "https://staging.zoho-clone.com?access_token=secret",
      "https://staging.zoho-clone.com/health/live",
      "https://staging.zoho-clone.com/#fragment",
    ];
    for (const url of bad) {
      assert.throws(() => requireApprovedStagingUrl(url), /P3_STAGING_URL_/);
    }
  });
});
