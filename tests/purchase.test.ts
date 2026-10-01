import assert from "node:assert/strict";
import test from "node:test";
import { calculatePurchaseValues, isValidPurchaseDate, todayInIndia } from "../lib/utils/purchase";
import { dbFundToFund } from "../lib/supabase/mappers";
import type { DbFund } from "../lib/supabase/database.types";

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

test("saved purchase metadata appears on the holding", () => {
  const row = {
    id: "fund-1", portfolio_id: "portfolio-1", name: "Test Fund", category: "large_cap",
    invested_amount: 248.44, current_value: 317.02, nav: 25.6789, units: 12.3456,
    returns_1y: 0, returns_3y: 0, returns_5y: 0, risk_level: "moderate",
    expense_ratio: 0, aum: 0, benchmark: null, manager: null,
    created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z",
  } as DbFund;
  const fund = dbFundToFund(row, {
    fund_id: row.id,
    created_at: "2025-02-15T12:00:00Z",
    nav: 20.1234,
  });
  assert.equal(fund.purchaseDate, "2025-02-15");
  assert.equal(fund.purchaseNav, 20.1234);
  assert.equal(dbFundToFund(row).purchaseDate, undefined);
});
