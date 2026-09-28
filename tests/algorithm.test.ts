import assert from "node:assert/strict";
import test from "node:test";
import { allocationEngine, AllocationEngine } from "../lib/algorithm/allocationEngine";
import { createRebalanceEngine } from "../lib/algorithm/rebalanceEngine";
import { riskEngine } from "../lib/algorithm/riskEngine";
import type { Fund } from "../lib/types";

function fund(overrides: Partial<Fund> = {}): Fund {
  return {
    id: "fund-1",
    name: "Test Fund",
    category: "large_cap",
    investedAmount: 100_000,
    currentValue: 100_000,
    nav: 100,
    units: 1_000,
    returns1Y: 10,
    returns3Y: 12,
    returns5Y: 14,
    riskLevel: "moderate",
    expenseRatio: 0.5,
    aum: 1_000,
    benchmark: "Nifty 100",
    manager: "",
    ...overrides,
  };
}

test("weighted drawback vector follows the documented ratio", () => {
  const result = AllocationEngine.fromWorkedExample(30_000, [
    { fundId: "a", fundName: "A", drawbackPercent: 10 },
    { fundId: "b", fundName: "B", drawbackPercent: 20 },
  ]);
  assert.equal(result[0].capitalDeployed, 10_000);
  assert.equal(result[1].capitalDeployed, 20_000);
});

test("alpha stays as dry powder when no holding is below cost", () => {
  const result = allocationEngine.deployAlphaPool(12_000, [fund({ currentValue: 110_000 })]);
  assert.equal(result.sweptToDryPowder, 12_000);
  assert.equal(result.deployments.length, 0);
});

test("zero or invalid alpha never creates negative deployments", () => {
  assert.equal(allocationEngine.deployAlphaPool(0, [fund()]).totalAlphaPool, 0);
  assert.equal(allocationEngine.deployAlphaPool(-5_000, [fund({ currentValue: 90_000 })]).deployments.length, 0);
});

test("QRP preserves the configured principal pillar and captures net alpha", () => {
  const engine = createRebalanceEngine({ principalAmount: 100_000, pillarBaseAmount: 100_000, alphaTriggerPercent: 12 });
  const result = engine.processPortfolioState([
    { ...fund({ currentValue: 120_000 }), lotAgeDays: 400, settlementSlippagePercent: 0 },
  ]);
  assert.equal(result.updatedFunds[0].currentValue, 100_000);
  assert.equal(result.alphaPool, 20_000);
  assert.equal(result.netAlphaPool, 20_000);
  assert.equal(result.dryPowderAdded, 20_000);
});

test("recommendations expose their trigger, target, and rupee calculation", () => {
  const engine = createRebalanceEngine();
  const weakFund = fund({ currentValue: 90_000, returns1Y: -12, riskLevel: "high" });
  const suggestions = engine.generateRebalancingSuggestions([weakFund], 90_000);
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].action, "exit");
  assert.equal(suggestions[0].suggestedAmount, 90_000);
  assert.match(suggestions[0].trigger, /below -10%/);
  assert.match(suggestions[0].calculation, /100\.00%/);
});

test("empty portfolios return no recommendation instead of NaN values", () => {
  const engine = createRebalanceEngine();
  assert.deepEqual(engine.generateRebalancingSuggestions([], 0), []);
  assert.deepEqual(engine.generateRebalancingSuggestions([fund({ currentValue: 0 })], 0), []);
});

test("portfolio analysis carries deterministic recommendations into the UI contract", () => {
  const weakFund = fund({ currentValue: 90_000, returns1Y: -12, riskLevel: "high" });
  const analysis = riskEngine.analyzePortfolio({
    id: "portfolio-1",
    userId: "user-1",
    name: "Test Portfolio",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    funds: [weakFund],
    totalInvested: 100_000,
    currentValue: 90_000,
    returns: -10_000,
    returnsPercent: -10,
    healthScore: 0,
    riskScore: 0,
  });
  assert.equal(analysis.rebalancingSuggestions[0].fundId, weakFund.id);
  assert.equal(analysis.rebalancingSuggestions[0].suggestedAmount, 90_000);
});
