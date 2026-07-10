import type { Fund } from "../types";
import { createRebalanceEngine } from "./rebalanceEngine";

export interface ScenarioDefinition {
  key: string;
  label: string;
  description: string;
  condition: "bull" | "bear" | "sideways" | "volatile";
  driftBoost: number;
}

export interface ScenarioModelResult {
  finalValue: number;
  returnPercent: number;
  alphaGenerated: number;
  rebalanceEvents: number;
}

export interface ScenarioResult {
  scenario: ScenarioDefinition;
  naive: ScenarioModelResult;
  qrp15: ScenarioModelResult;
  qrp10: ScenarioModelResult;
}

// Mirrors simulationEngine.ts's constants — kept separate rather than
// imported so this file can vary drift independently per scenario
// (needed for the Hyper-Bull case) without touching the existing
// month-by-month simulator used elsewhere in the app.
const VOLATILITY: Record<ScenarioDefinition["condition"], number> = {
  bull: 0.03,
  bear: 0.06,
  sideways: 0.02,
  volatile: 0.08,
};

const DRIFT: Record<ScenarioDefinition["condition"], number> = {
  bull: 0.008,
  bear: -0.004,
  sideways: 0.001,
  volatile: 0.002,
};

export const QRP_SCENARIOS: ScenarioDefinition[] = [
  { key: "bear", label: "Bear Market", description: "Sustained 12-month decline", condition: "bear", driftBoost: 1 },
  { key: "stagnant", label: "Stagnant / Sideways", description: "Flat, choppy, directionless", condition: "sideways", driftBoost: 1 },
  { key: "bull", label: "Bull Market", description: "Steady, healthy uptrend", condition: "bull", driftBoost: 1 },
  { key: "volatile", label: "High Volatility", description: "Sharp swings, no clear trend", condition: "volatile", driftBoost: 1 },
  { key: "hyperBull", label: "Hyper-Bull", description: "Aggressive, fast-compounding rally", condition: "bull", driftBoost: 2.2 },
];

function generateMonthlyPath(scenario: ScenarioDefinition, months: number): number[] {
  const volatility = VOLATILITY[scenario.condition];
  const drift = DRIFT[scenario.condition] * scenario.driftBoost;
  const path: number[] = [];
  for (let m = 0; m < months; m++) {
    const noise = (Math.random() - 0.5) * 2 * volatility;
    path.push(drift + noise);
  }
  return path;
}

function buildSyntheticFunds(fundCount: number, initialInvestment: number): Fund[] {
  const perFund = initialInvestment / fundCount;
  return Array.from({ length: fundCount }, (_, i) => ({
    id: `sim-${i}`,
    name: `Fund ${i + 1}`,
    category: "flexi_cap" as const,
    investedAmount: perFund,
    currentValue: perFund,
    nav: 1,
    units: perFund,
    returns1Y: 0,
    returns3Y: 0,
    returns5Y: 0,
    riskLevel: "moderately_high" as const,
    expenseRatio: 1,
    aum: 1000,
    benchmark: "Nifty 500",
    manager: "Simulated",
  }));
}

function runNaive(initialInvestment: number, monthlyPath: number[]): ScenarioModelResult {
  let value = initialInvestment;
  for (const monthlyReturn of monthlyPath) {
    value *= 1 + monthlyReturn;
  }
  return {
    finalValue: value,
    returnPercent: ((value - initialInvestment) / initialInvestment) * 100,
    alphaGenerated: 0,
    rebalanceEvents: 0,
  };
}

function runQRP(initialInvestment: number, fundCount: number, monthlyPath: number[], triggerPercent: number): ScenarioModelResult {
  const engine = createRebalanceEngine({ alphaTriggerPercent: triggerPercent });
  let funds = buildSyntheticFunds(fundCount, initialInvestment);
  let cumulativeAlpha = 0;
  let rebalanceEvents = 0;

  for (const monthlyReturn of monthlyPath) {
    // Apply this month's systemic market move uniformly across funds — a
    // portfolio-wide scenario stress test (Page 4) models a market-wide
    // condition, not idiosyncratic single-fund dispersion.
    funds = funds.map((f) => ({ ...f, currentValue: f.currentValue * (1 + monthlyReturn) }));

    const result = engine.processPortfolioState(funds);
    funds = result.updatedFunds;
    if (result.realizedProfitLedger > 0) {
      cumulativeAlpha += result.realizedProfitLedger;
      rebalanceEvents += 1;
    }
  }

  // Extracted alpha isn't withdrawn from the system — per the spec it's
  // redeployed elsewhere in the same portfolio (Weighted Drawback Vector)
  // or held as Dry Powder — so it still counts toward total wealth here,
  // just held separately from the still-invested fund principal.
  const totalFundValue = funds.reduce((sum, f) => sum + f.currentValue, 0);
  const finalValue = totalFundValue + cumulativeAlpha;

  return {
    finalValue,
    returnPercent: ((finalValue - initialInvestment) / initialInvestment) * 100,
    alphaGenerated: cumulativeAlpha,
    rebalanceEvents,
  };
}

/**
 * Runs the QRP Scenario Stress Test (Page 4 of the algorithm spec): for
 * each of the 5 canonical market conditions, compares a naive buy-and-hold
 * baseline against QRP at a 15% trigger and a 10% trigger, over a 12-month
 * horizon. Each scenario uses one shared random monthly-return path across
 * all three models so the comparison is apples-to-apples — generating the
 * path separately per model (as calling the existing simulator twice
 * would) would give each model a different random market to react to,
 * making the comparison meaningless.
 */
export function runScenarioMatrix(initialInvestment: number, fundCount: number, months = 12): ScenarioResult[] {
  const safeFundCount = Math.max(1, fundCount);

  return QRP_SCENARIOS.map((scenario) => {
    const monthlyPath = generateMonthlyPath(scenario, months);
    return {
      scenario,
      naive: runNaive(initialInvestment, monthlyPath),
      qrp15: runQRP(initialInvestment, safeFundCount, monthlyPath, 15),
      qrp10: runQRP(initialInvestment, safeFundCount, monthlyPath, 10),
    };
  });
}
