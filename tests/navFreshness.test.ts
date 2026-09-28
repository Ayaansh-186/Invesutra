import assert from "node:assert/strict";
import test from "node:test";
import { isRecentNav } from "../lib/marketData/navFreshness";

const now = new Date("2026-09-28T12:00:00Z");

test("accepts recently dated NAV through a weekend", () => {
  assert.equal(isRecentNav("25-09-2026", now), true);
  assert.equal(isRecentNav("18-09-2026", now), true);
});

test("rejects stale, missing, invalid, and future NAV dates", () => {
  for (const date of ["05-11-2013", "17-09-2026", "31-02-2026", "2026-09-28", "30-09-2026", undefined]) {
    assert.equal(isRecentNav(date, now), false);
  }
});
