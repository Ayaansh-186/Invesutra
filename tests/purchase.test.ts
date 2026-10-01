import assert from "node:assert/strict";
import test from "node:test";
import { calculatePurchaseValues, isValidPurchaseDate, todayInIndia } from "../lib/utils/purchase";

test("purchase amounts come from price, units, and latest NAV", () => {
  assert.deepEqual(calculatePurchaseValues(20.1234, 12.3456, 25.6789), {
    investedAmount: 248.44,
    currentValue: 317.02,
  });
  assert.equal(calculatePurchaseValues(0, 10, 25), null);
  assert.equal(calculatePurchaseValues(20, Number.NaN, 25), null);
});

test("purchase date uses the user's India calendar day", () => {
  const now = new Date("2026-09-30T19:00:00Z");
  assert.equal(todayInIndia(now), "2026-10-01");
  assert.equal(isValidPurchaseDate("2026-10-01", now), true);
  assert.equal(isValidPurchaseDate("2026-10-02", now), false);
  assert.equal(isValidPurchaseDate("2026-02-30", now), false);
});
