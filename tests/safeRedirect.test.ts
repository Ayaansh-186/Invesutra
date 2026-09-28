import assert from "node:assert/strict";
import test from "node:test";
import { safeInternalRedirect } from "../lib/utils/safeRedirect";

test("keeps an internal AI question through sign-in", () => {
  assert.equal(safeInternalRedirect("/dashboard?q=Explain%20my%20risk"), "/dashboard?q=Explain%20my%20risk");
});

test("rejects external and protocol-relative redirects", () => {
  for (const value of ["https://example.com", "//example.com", "/\\example.com", "javascript:alert(1)"]) {
    assert.equal(safeInternalRedirect(value), "/dashboard");
  }
});
