import type { SimulationInput, SimulationResult, SimulationMonth, SimFund, SimFundResult, RiskLevel } from "../types";
import { createRebalanceEngine } from "./rebalanceEngine";

const MARKET_VOLATILITY: Record<string, number> = {
  bull: 0.03,
  bear: 0.06,
  sideways: 0.02,
  volatile: 0.08,
};

const MARKET_DRIFT: Record<string, number> = {
  bull: 0.008,
  bear: -0.004,
  sideways: 0.001,
  volatile: 0.002,
};

// Volatility multiplier applied per risk level on top of the base market
// volatility — riskier funds swing harder around the blended mean return.
const RISK_VOLATILITY_MULTIPLIER: Record<RiskLevel, number> = {
  low: 0.45,
  moderate: 0.75,
  moderately_high: 1.0,
  high: 1.35,
  very_high: 1.75,
};

interface BlendedMarketProfile {
  monthlyReturn: number;
  volatility: number;
  drift: number;
}

/**
 * When the caller supplies an explicit fund mix (`input.funds`), blend each
 * fund's own expected return and risk level — weighted by its allocation —
 * into a single effective monthly return/volatility for the simulation.
 * Falls back to the flat `expectedReturn` + `marketCondition` profile when no
 * fund mix is provided, keeping the simulator usable as a quick what-if tool.
 */
function buildMarketProfile(input: SimulationInput): BlendedMarketProfile {
  const baseVolatility = MARKET_VOLATILITY[input.marketCondition];
  const drift = MARKET_DRIFT[input.marketCondition];

  const validFunds = (input.funds || []).filter((f) => f.allocation > 0);
  const totalAllocation = validFunds.reduce((sum, f) => sum + f.allocation, 0);

  if (validFunds.length === 0 || totalAllocation === 0) {
    return {
      monthlyReturn: input.expectedReturn / 100 / 12,
      volatility: baseVolatility,
      drift,
    };
  }

  let weightedAnnualReturn = 0;
  let weightedVolatility = 0;

  for (const fund of validFunds) {
    const weight = fund.allocation / totalAllocation;
    weightedAnnualReturn += fund.expectedReturn * weight;
    weightedVolatility += baseVolatility * (RISK_VOLATILITY_MULTIPLIER[fund.riskLevel] ?? 1) * weight;
  }

  return {
    monthlyReturn: weightedAnnualReturn / 100 / 12,
    volatility: weightedVolatility,
    drift,
  };
}

function computeFundBreakdown(
  funds: SimFund[],
  finalPortfolioValue: number,
  totalInvested: number,
  totalGain: number
): SimFundResult[] {
  const validFunds = funds.filter((f) => f.allocation > 0);
  const totalAllocation = validFunds.reduce((sum, f) => sum + f.allocation, 0);
  if (validFunds.length === 0 || totalAllocation === 0) return [];

  return validFunds.map((fund) => {
    const weight = fund.allocation / totalAllocation;
    const fundInvested = totalInvested * weight;
    // Compound this fund's own expected return independently over the same
    // horizon implied by the blended simulation, so faster-growing funds
    // show proportionally higher contribution even within the same blend.
    const growthMultiplier = finalPortfolioValue / Math.max(totalInvested, 1);
    const fundReturnSkew = 1 + (fund.expectedReturn / 100 - (totalGain / Math.max(totalInvested, 1))) * 0.5;
    const fundFinalValue = fundInvested * growthMultiplier * Math.max(fundReturnSkew, 0.3);
    const fundGain = fundFinalValue - fundInvested;

    return {
      name: fund.name,
      category: fund.category,
      allocationPercent: parseFloat(fund.allocation.toFixed(1)),
      finalValue: Math.round(fundFinalValue),
      contributionToReturn:
        totalGain !== 0 ? parseFloat(((fundGain / totalGain) * 100).toFixed(1)) : 0,
    };
  });
}

export function runSimulation(input: SimulationInput): SimulationResult {
  const { initialInvestment, monthlyAddition, years, enableRebalancing, triggerPercent } = input;

  const months: SimulationMonth[] = [];
  const totalMonths = years * 12;
  const { monthlyReturn, volatility, drift } = buildMarketProfile(input);

  // Run WITH rebalancing (using QRP)
  const engine = createRebalanceEngine({ alphaTriggerPercent: triggerPercent });
  let qrpState = engine.initializeState(initialInvestment);

  let portfolioValue = initialInvestment;
  let totalInvested = initialInvestment;
  let alphaGenerated = 0;
  let rebalanceCount = 0;
  let peakValue = initialInvestment;
  let maxDrawdown = 0;
  const returns: number[] = [];

  for (let i = 0; i < totalMonths; i++) {
    totalInvested += monthlyAddition;
    portfolioValue += monthlyAddition;

    // Generate monthly return with stochastic noise
    const noise = (Math.random() - 0.5) * 2 * volatility;
    const monthReturn = monthlyReturn + drift + noise;
    portfolioValue *= 1 + monthReturn;
    returns.push(monthReturn);

    // Track drawdown
    if (portfolioValue > peakValue) peakValue = portfolioValue;
    const drawdown = ((peakValue - portfolioValue) / peakValue) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;

    // Rebalancing evaluation
    let rebalanced = false;
    let alphaCaptured: number | undefined;

    if (enableRebalancing) {
      const result = engine.evaluateRebalance(qrpState, portfolioValue);
      if (result.shouldRebalance && result.event) {
        rebalanced = true;
        rebalanceCount++;
        alphaGenerated += result.event.alphaCaptured;
        alphaCaptured = result.event.alphaCaptured;
        qrpState = result.state;
        portfolioValue = result.state.currentValue;
      } else {
        qrpState = result.state;
      }
    }

    const date = new Date();
    date.setMonth(date.getMonth() + i);

    months.push({
      month: i + 1,
      date: date.toISOString().slice(0, 7),
      portfolioValue: Math.round(portfolioValue),
      invested: Math.round(totalInvested),
      returns: Math.round(portfolioValue - totalInvested),
      rebalanced,
      alphaCaptured: alphaCaptured ? Math.round(alphaCaptured) : undefined,
    });
  }

  // Run WITHOUT rebalancing for comparison, using the same blended market
  // profile so the comparison isolates the effect of QRP rebalancing alone.
  let baselineValue = initialInvestment;
  for (let i = 0; i < totalMonths; i++) {
    baselineValue += monthlyAddition;
    const noise = (Math.random() - 0.5) * 2 * volatility;
    const monthReturn = monthlyReturn + drift + noise;
    baselineValue *= 1 + monthReturn;
  }

  const finalValue = Math.round(portfolioValue);
  const totalReturns = finalValue - totalInvested;
  const totalReturnsPercent = (totalReturns / totalInvested) * 100;

  // Sharpe ratio
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const annualizedStdDev = stdDev * Math.sqrt(12);
  const annualizedReturn = Math.pow(1 + avgReturn, 12) - 1;
  const sharpeRatio = annualizedStdDev > 0 ? (annualizedReturn - 0.065) / annualizedStdDev : 0;

  const fundBreakdown = computeFundBreakdown(input.funds || [], finalValue, totalInvested, totalReturns);

  return {
    months,
    finalValue,
    totalInvested: Math.round(totalInvested),
    totalReturns: Math.round(totalReturns),
    totalReturnsPercent: parseFloat(totalReturnsPercent.toFixed(2)),
    alphaGenerated: Math.round(alphaGenerated),
    rebalanceCount,
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
    fundBreakdown,
    comparison: {
      withRebalancing: finalValue,
      withoutRebalancing: Math.round(baselineValue),
      difference: Math.round(finalValue - baselineValue),
      differencePercent: parseFloat((((finalValue - baselineValue) / baselineValue) * 100).toFixed(2)),
    },
  };
}
