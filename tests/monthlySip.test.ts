import assert from "node:assert/strict";
import test from "node:test";
import { parseMonthlySipAmount } from "../lib/utils/monthlySip";
import { fundToDbInsert, dbFundToFund, recalculatePortfolio } from "../lib/supabase/mappers";
import { SAMPLE_FUNDS, SAMPLE_PORTFOLIO } from "../lib/utils/mockData";
import type { DbFund } from "../lib/supabase/database.types";

test("monthly plans validate positive two-decimal amounts without coercing invalid data", () => {
  for (const value of [undefined, null, ""]) assert.equal(parseMonthlySipAmount(value), undefined);
  for (const value of [0, -1, NaN, Infinity, 1e9, 100.001, "5000", true, {}]) assert.equal(parseMonthlySipAmount(value), null);
  assert.equal(parseMonthlySipAmount(5000), 5000);
  assert.equal(parseMonthlySipAmount(0.01), 0.01);
  assert.equal(parseMonthlySipAmount(999999999.99), 999999999.99);
});

test("monthly plans persist separately, and legacy purchases omit the new column", () => {
  const fund = SAMPLE_FUNDS[0];
  const payload = fundToDbInsert({ ...fund, monthlySipAmount: 5000 }, "portfolio");
  assert.equal(payload.monthly_sip_amount, 5000);
  const restored = dbFundToFund({ ...payload, id: "fund", created_at: "2026-01-01", updated_at: "2026-01-01" } as DbFund);
  assert.equal(restored.monthlySipAmount, 5000);
  assert.equal(restored.investedAmount, fund.investedAmount);
  assert.equal(restored.units, fund.units);
  assert.equal("monthly_sip_amount" in fundToDbInsert(fund, "portfolio"), false);
});

test("planned monthly money never inflates cost, value, units or returns", () => {
  const before = recalculatePortfolio(SAMPLE_PORTFOLIO);
  const after = recalculatePortfolio({ ...SAMPLE_PORTFOLIO, funds: SAMPLE_PORTFOLIO.funds.map(fund => ({ ...fund, monthlySipAmount: 10000 })) });
  for (const key of ["totalInvested", "currentValue", "returns", "returnsPercent"] as const) assert.equal(after[key], before[key]);
  assert.deepEqual(after.funds.map(fund => fund.units), before.funds.map(fund => fund.units));
});
