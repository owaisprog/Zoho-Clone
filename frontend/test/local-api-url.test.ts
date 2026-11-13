import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeLocalApiBase } from "../src/lib/local-api-url";

describe("P3.03 local-only API outbound request guard", () => {
  it("accepts only explicitly local uncredentialed HTTP endpoints", () => {
    assert.equal(safeLocalApiBase(undefined)?.origin, "http://127.0.0.1:4000");
    assert.equal(safeLocalApiBase("http://localhost:4000")?.origin, "http://localhost:4000");
  });
  it("blocks remote addresses, credentials, non-HTTP schemes, paths and malformed URLs", () => {
    for (const url of [
      "https://api.example.com", "http://example.com:4000", "http://0.0.0.0:4000",
      "http://127.0.0.1.evil.example:4000", "http://user:pass@localhost:4000",
      "http://localhost:4000/secrets", "http://localhost:4000/?token=sensitive",
      "file:///etc/passwd", "notaurl",
    ]) assert.equal(safeLocalApiBase(url), null, url);
  });
});
