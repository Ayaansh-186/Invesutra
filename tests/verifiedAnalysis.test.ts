import assert from "node:assert/strict";
import test from "node:test";
import { SAMPLE_PORTFOLIO } from "../lib/utils/mockData";
import { riskEngine } from "../lib/algorithm/riskEngine";
import { portfolioSimulationInputs } from "../lib/algorithm/portfolioSimulation";
import { recalculatePortfolio } from "../lib/supabase/mappers";
import { formatRiskMetric } from "../lib/utils/format";
import { parsePurchaseCorrection, purchaseHistoryRepairError } from "../lib/utils/holdingRepair";

test("historical risk statistics are unavailable rather than fabricated", () => {
  const analysis = riskEngine.analyzePortfolio(SAMPLE_PORTFOLIO);
  assert.deepEqual(analysis.riskMetrics, { beta: null, sharpeRatio: null, standardDeviation: null, maxDrawdown: null, valueAtRisk: null });
  assert.match(analysis.aiInsights.join(" "), /model assessments/);
  const recalculated = recalculatePortfolio(SAMPLE_PORTFOLIO);
  assert.equal(recalculated.healthScore, analysis.healthScore);
  assert.equal(recalculated.riskScore, analysis.riskScore);
});

test("unverified or invalid valuations cannot produce allocation actions or scores", () => {
  for (const funds of [SAMPLE_PORTFOLIO.funds.map(f => ({ ...f, valuationStatus: "pending" as const })),
    SAMPLE_PORTFOLIO.funds.map(f => ({ ...f, currentValue: NaN }))]) {
    const analysis = riskEngine.analyzePortfolio({ ...SAMPLE_PORTFOLIO, funds, valuationComplete: false });
    assert.equal(analysis.healthScore, 0);
    assert.equal(analysis.riskScore, 0);
    assert.deepEqual(analysis.rebalancingSuggestions, []);
    assert.deepEqual(analysis.allocationBreakdown.byCategory, {});
  }
});

test("simulator uses the chosen assumption and latest value, not trailing returns", () => {
  const input = portfolioSimulationInputs(SAMPLE_PORTFOLIO, 9);
  assert.ok(input);
  assert.equal(input.initialInvestment, Math.round(SAMPLE_PORTFOLIO.funds.reduce((sum, fund) => sum + fund.currentValue, 0)));
  assert.ok(input.funds.every(f => f.expectedReturn === 9));
  assert.ok(Math.abs(input.funds.reduce((sum, fund) => sum + fund.allocation, 0) - 100) < 0.00001);
});

test("simulator rejects missing units, stale prices, unverified costs and invalid assumptions", () => {
  for (const patch of [{ valuationStatus: "pending" as const }, { valuationStatus: "stale" as const },
    { units: 0 }, { currentValue: -1 }, { purchaseStatus: "unverified" as const }]) {
    assert.equal(portfolioSimulationInputs({ ...SAMPLE_PORTFOLIO, funds: [{ ...SAMPLE_PORTFOLIO.funds[0], ...patch }] }, 9), null);
  }
  assert.equal(portfolioSimulationInputs({ ...SAMPLE_PORTFOLIO, purchaseComplete: false }, 9), null);
  for (const assumption of [NaN, Infinity, -100, 101]) assert.equal(portfolioSimulationInputs(SAMPLE_PORTFOLIO, assumption), null);
});

test("risk formatter preserves real zero but marks absent or invalid statistics unavailable", () => {
  assert.equal(formatRiskMetric(0), "0.00");
  assert.equal(formatRiskMetric(12.34, 1, "%"), "12.3%");
  for (const value of [null, NaN, Infinity]) assert.equal(formatRiskMetric(value, 1, "%"), "Unavailable");
});

test("purchase corrections validate quantities, bounds and real calendar dates", () => {
  const valid = { schemeCode: "123", purchaseNav: 20, units: 100.1234, purchaseDate: "2020-09-01" };
  assert.deepEqual(parsePurchaseCorrection(valid), valid);
  for (const patch of [{ units: 0 }, { units: Infinity }, { units: 1.12345 }, { purchaseNav: 1e6 },
    { purchaseDate: "2020-02-30" }, { purchaseDate: "2999-01-01" }, { schemeCode: "123x" }, { units: "100" }]) {
    assert.equal(parsePurchaseCorrection({ ...valid, ...patch }), null);
  }
  assert.equal(parsePurchaseCorrection(null), null);
});

test("purchase correction preserves known scheme identity and multi-transaction history", () => {
  assert.equal(purchaseHistoryRepairError([], "123"), null);
  assert.equal(purchaseHistoryRepairError([{ type: "buy", notes: "AMFI scheme 123" }], "123"), null);
  assert.match(purchaseHistoryRepairError([{ type: "buy", notes: "AMFI scheme 123" }], "456")!, /scheme cannot be changed/);
  assert.match(purchaseHistoryRepairError([{ type: "sell", notes: null }], "123")!, /history is preserved/);
  assert.ok(purchaseHistoryRepairError([{ type: "buy", notes: null }, { type: "buy", notes: null }], "123"));
});
