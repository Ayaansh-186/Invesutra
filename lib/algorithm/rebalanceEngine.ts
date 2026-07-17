/**
 * QuantRebalance Protocol Engine
 * TypeScript implementation of the QRP algorithm
 * 
 * Core principles:
 * - Principal Layer Protection: never risk the original capital
 * - Alpha Pool extraction: capture gains systematically
 * - Profit milestone triggers: rebalance at defined thresholds
 * - Weighted drawback allocation: protect gains during corrections
 * - Dry Powder reserve system: maintain liquidity for opportunities
 */

import type { QRPConfig, QRPState, RebalanceEvent, Fund, RebalancingSuggestion } from "../types";
import { allocationEngine, type AllocationResult } from "./allocationEngine";

export interface FundProtocolInput extends Fund {
  lotAgeDays?: number;
  exitLoadPercent?: number;
  stcgTaxPercent?: number;
  pillarBaseAmount?: number;
  /** Forward NAV settlement slippage (Page 5) — mutual fund redemptions
   * execute at the *next* business day's unknown NAV, not the NAV visible
   * at decision time. Defaults to a conservative fixed estimate if unset. */
  settlementSlippagePercent?: number;
}

export interface ProtocolOrder {
  fundId: string;
  fundName: string;
  action: "redeem" | "reinvest_principal" | "deploy_alpha" | "sweep_to_dry_powder";
  amount: number;
  reasoning: string;
}

export interface FundProtocolResult {
  updatedFunds: FundProtocolInput[];
  alphaPool: number;
  netAlphaPool: number;
  dryPowderAdded: number;
  realizedProfitLedger: number;
  totalFrictionCost: number;
  deploymentPlan: AllocationResult;
  orders: ProtocolOrder[];
}

export class QuantRebalanceEngine {
  private config: QRPConfig;

  constructor(config: QRPConfig) {
    this.config = config;
  }

  /** Public read access to the configured alpha capture percentage. */
  get alphaTriggerPercent(): number {
    return this.config.alphaTriggerPercent;
  }

  /**
   * Given a captured alpha amount and the current fund universe, computes
   * exactly where that capital should be deployed using the Weighted
   * Drawback Vector (Page 3 of the algorithm spec) — or swept to Dry Powder
   * if no fund is currently trading below its cost basis.
   */
  planAlphaDeployment(alphaAmount: number, funds: Fund[]): AllocationResult {
    return allocationEngine.deployAlphaPool(alphaAmount, funds);
  }

  /**
   * Executes the MutualFundAlgorithm.md fund-level protocol:
   * - each fund is checked against its own trigger,
   * - the original principal pillar is immediately restored,
   * - net alpha is routed through the Weighted Drawback Vector,
   * - if there are no drawbacks, alpha is held as dry powder.
   */
  processPortfolioState(funds: FundProtocolInput[]): FundProtocolResult {
    const updatedFunds = funds.map((fund) => ({ ...fund }));
    const orders: ProtocolOrder[] = [];
    let grossAlphaPool = 0;
    let netAlphaPool = 0;
    let realizedProfitLedger = 0;
    let totalFrictionCost = 0;

    // Per-fund Pillar Base: A_i = P0 / N (Page 2). Prefer an explicit
    // configured or fund-level base so redeployed alpha does not inflate
    // the principal layer in later cycles.
    const pillarBase = this.computePillarBase(funds);

    for (const fund of updatedFunds) {
      const costBasis = fund.investedAmount;
      if (costBasis <= 0) continue;

      const returnPercent = ((fund.currentValue - costBasis) / costBasis) * 100;
      const triggerPercent = this.getFundTriggerPercent(fund);

      if (returnPercent < triggerPercent) continue;

      const grossRedemption = fund.currentValue;
      // Never "reinvest" more than what was actually redeemed — guards
      // against a fund whose position is smaller than the portfolio's
      // average pillar size (e.g. a newly added, small allocation).
      const principalReinvestment = Math.min(pillarBase, grossRedemption);
      const grossAlpha = Math.max(0, grossRedemption - principalReinvestment);
      const frictionCost = this.calculateFrictionCost(fund, grossRedemption, grossAlpha);
      const netAlpha = Math.max(0, grossAlpha - frictionCost);

      grossAlphaPool += grossAlpha;
      netAlphaPool += netAlpha;
      realizedProfitLedger += netAlpha;
      totalFrictionCost += frictionCost;

      orders.push({
        fundId: fund.id,
        fundName: fund.name,
        action: "redeem",
        amount: grossRedemption,
        reasoning: `${fund.name} crossed its ${triggerPercent}% milestone with a ${returnPercent.toFixed(2)}% gain.`,
      });
      orders.push({
        fundId: fund.id,
        fundName: fund.name,
        action: "reinvest_principal",
        amount: principalReinvestment,
        reasoning: "Core principal is restored to preserve the compounding engine.",
      });

      fund.currentValue = principalReinvestment;
      fund.investedAmount = principalReinvestment;
      fund.units = fund.nav > 0 ? principalReinvestment / fund.nav : fund.units;
    }

    const deploymentPlan = allocationEngine.deployAlphaPool(netAlphaPool, updatedFunds);

    for (const deployment of deploymentPlan.deployments) {
      const target = updatedFunds.find((fund) => fund.id === deployment.fundId);
      if (!target) continue;

      target.currentValue += deployment.capitalDeployed;
      target.investedAmount += deployment.capitalDeployed;
      target.units = target.nav > 0 ? target.currentValue / target.nav : target.units;

      orders.push({
        fundId: deployment.fundId,
        fundName: deployment.fundName,
        action: "deploy_alpha",
        amount: deployment.capitalDeployed,
        reasoning: `${deployment.drawbackPercent}% drawback receives ${(deployment.weight * 100).toFixed(2)}% of the net alpha pool.`,
      });
    }

    if (deploymentPlan.sweptToDryPowder > 0) {
      orders.push({
        fundId: "dry-powder",
        fundName: "Dry Powder Reserve",
        action: "sweep_to_dry_powder",
        amount: deploymentPlan.sweptToDryPowder,
        reasoning: "No fund is below cost basis, so alpha stays liquid instead of chasing elevated assets.",
      });
    }

    return {
      updatedFunds,
      alphaPool: Number(grossAlphaPool.toFixed(2)),
      netAlphaPool: Number(netAlphaPool.toFixed(2)),
      dryPowderAdded: Number(deploymentPlan.sweptToDryPowder.toFixed(2)),
      realizedProfitLedger: Number(realizedProfitLedger.toFixed(2)),
      totalFrictionCost: Number(totalFrictionCost.toFixed(2)),
      deploymentPlan,
      orders,
    };
  }

  /**
   * Initialize a new QRP state from a starting investment
   */
  initializeState(principalAmount: number): QRPState {
    const dryPowder = principalAmount * (this.config.dryPowderPercent / 100);
    const activeDeployment = principalAmount - dryPowder;

    return {
      principalLayer: principalAmount,
      alphaPool: 0,
      dryPowder,
      activeDeployment,
      currentValue: principalAmount,
      totalReturns: 0,
      totalReturnsPercent: 0,
      rebalanceHistory: [],
    };
  }

  /**
   * Update state with current portfolio value and determine if rebalancing is needed
   */
  evaluateRebalance(state: QRPState, currentValue: number): {
    state: QRPState;
    shouldRebalance: boolean;
    trigger?: string;
    event?: RebalanceEvent;
  } {
    const updatedState = { ...state, currentValue };
    const totalReturns = currentValue - state.principalLayer;
    const returnsPercent = (totalReturns / state.principalLayer) * 100;

    updatedState.totalReturns = totalReturns;
    updatedState.totalReturnsPercent = returnsPercent;

    // Check milestone triggers
    const triggeredMilestone = this.checkMilestoneTrigger(returnsPercent, state);
    if (triggeredMilestone !== null) {
      const event = this.executeRebalance(updatedState, currentValue, `Milestone: ${triggeredMilestone}% gain`);
      return {
        state: this.applyRebalanceEvent(updatedState, event),
        shouldRebalance: true,
        trigger: `Portfolio reached ${triggeredMilestone}% gain milestone`,
        event,
      };
    }

    // Check drawdown protection trigger
    const drawdownTriggered = this.checkDrawdownTrigger(updatedState, currentValue);
    if (drawdownTriggered) {
      const event = this.executeRebalance(updatedState, currentValue, "Drawdown Protection");
      return {
        state: this.applyRebalanceEvent(updatedState, event),
        shouldRebalance: true,
        trigger: "Drawdown protection activated",
        event,
      };
    }

    return { state: updatedState, shouldRebalance: false };
  }

  private checkMilestoneTrigger(returnsPercent: number, state: QRPState): number | null {
    for (const milestone of this.config.milestones.sort((a, b) => a - b)) {
      if (returnsPercent >= milestone) {
        // Check if we already triggered this milestone
        const alreadyTriggered = state.rebalanceHistory.some(
          (e) => e.trigger.includes(`Milestone: ${milestone}%`)
        );
        if (!alreadyTriggered) {
          return milestone;
        }
      }
    }
    return null;
  }

  private getFundTriggerPercent(fund: FundProtocolInput): number {
    const ageDays = fund.lotAgeDays;
    if (typeof ageDays === "number" && ageDays >= 365) return Math.min(this.config.alphaTriggerPercent, 10);
    if (typeof ageDays === "number" && ageDays < 365) return Math.max(this.config.alphaTriggerPercent, 15);
    return this.config.alphaTriggerPercent;
  }

  private computePillarBase(funds: FundProtocolInput[]): number {
    const eligible = funds.filter((f) => f.investedAmount > 0);
    if (eligible.length === 0) return 0;
    const fundLevelBase = eligible.find((f) => typeof f.pillarBaseAmount === "number" && f.pillarBaseAmount > 0)
      ?.pillarBaseAmount;
    if (fundLevelBase) return fundLevelBase;
    if (this.config.pillarBaseAmount && this.config.pillarBaseAmount > 0) return this.config.pillarBaseAmount;
    if (this.config.principalAmount > 0) return this.config.principalAmount / eligible.length;
    const totalPrincipal = eligible.reduce((sum, f) => sum + f.investedAmount, 0);
    return totalPrincipal / eligible.length;
  }

  private calculateFrictionCost(fund: FundProtocolInput, grossRedemption: number, grossAlpha: number): number {
    const exitLoadPercent = fund.exitLoadPercent ?? (typeof fund.lotAgeDays === "number" && fund.lotAgeDays < 365 ? 1 : 0);
    const stcgTaxPercent = fund.stcgTaxPercent ?? (typeof fund.lotAgeDays === "number" && fund.lotAgeDays < 365 ? 20 : 0);
    // Forward NAV Settlement Slippage (Page 5): a redemption placed today
    // executes at the *next* business day's NAV, which is unknown at
    // decision time. Rather than model this as random noise (which would
    // make the same portfolio's friction cost flicker between renders for
    // no reason a user could act on), this uses a fixed, conservative
    // estimate of typical single-day NAV movement — defaults to 0.15% if
    // the caller doesn't supply a fund-specific figure.
    const slippagePercent = fund.settlementSlippagePercent ?? 0.15;
    const exitLoad = grossRedemption * (exitLoadPercent / 100);
    const tax = grossAlpha * (stcgTaxPercent / 100);
    const slippage = grossRedemption * (slippagePercent / 100);
    return exitLoad + tax + slippage;
  }

  private checkDrawdownTrigger(state: QRPState, currentValue: number): boolean {
    if (state.rebalanceHistory.length === 0) return false;
    const lastRebalance = state.rebalanceHistory[state.rebalanceHistory.length - 1];
    const drawdown =
      ((lastRebalance.portfolioValueAfter - currentValue) / lastRebalance.portfolioValueAfter) * 100;
    return drawdown >= this.config.drawbackPercent;
  }

  private executeRebalance(state: QRPState, currentValue: number, trigger: string): RebalanceEvent {
    const gains = currentValue - state.principalLayer;
    const alphaCaptured = gains > 0 ? gains * (this.config.alphaTriggerPercent / 100) : 0;
    const dryPowderAdded = alphaCaptured * (this.config.dryPowderPercent / 100);

    return {
      date: new Date().toISOString(),
      trigger,
      portfolioValueBefore: currentValue,
      portfolioValueAfter: currentValue - alphaCaptured,
      alphaCaptured,
      dryPowderAdded,
      actions: [
        `Captured ${alphaCaptured.toFixed(2)} as alpha profit`,
        `Added ${dryPowderAdded.toFixed(2)} to dry powder reserve`,
        `Principal layer protected at ${state.principalLayer.toFixed(2)}`,
        `Redeploying ${(alphaCaptured - dryPowderAdded).toFixed(2)} into high-conviction positions`,
      ],
    };
  }

  private applyRebalanceEvent(state: QRPState, event: RebalanceEvent): QRPState {
    return {
      ...state,
      alphaPool: state.alphaPool + event.alphaCaptured,
      dryPowder: state.dryPowder + event.dryPowderAdded,
      currentValue: event.portfolioValueAfter,
      lastRebalanceDate: event.date,
      rebalanceHistory: [...state.rebalanceHistory, event],
    };
  }

  /**
   * Generate rebalancing suggestions based on current fund allocation
   */
  generateRebalancingSuggestions(funds: Fund[], totalValue: number): RebalancingSuggestion[] {
    const suggestions: RebalancingSuggestion[] = [];
    const categoryExposure = this.calculateCategoryExposure(funds, totalValue);

    for (const fund of funds) {
      const currentAllocation = (fund.currentValue / totalValue) * 100;
      const suggestion = this.evaluateFund(fund, currentAllocation, categoryExposure);
      if (suggestion) suggestions.push(suggestion);
    }

    return suggestions;
  }

  private calculateCategoryExposure(funds: Fund[], totalValue: number): Record<string, number> {
    const exposure: Record<string, number> = {};
    for (const fund of funds) {
      const pct = (fund.currentValue / totalValue) * 100;
      exposure[fund.category] = (exposure[fund.category] || 0) + pct;
    }
    return exposure;
  }

  private evaluateFund(
    fund: Fund,
    currentAllocation: number,
    categoryExposure: Record<string, number>
  ): RebalancingSuggestion | null {
    // Mid-cap overexposure
    if (fund.category === "mid_cap" && categoryExposure["mid_cap"] > 35) {
      return {
        fundId: fund.id,
        fundName: fund.name,
        action: "decrease",
        currentAllocation,
        targetAllocation: currentAllocation * 0.8,
        reasoning: "Mid-cap exposure exceeds 35% — consider trimming to reduce volatility risk.",
      };
    }

    // Small-cap overexposure
    if (fund.category === "small_cap" && categoryExposure["small_cap"] > 25) {
      return {
        fundId: fund.id,
        fundName: fund.name,
        action: "decrease",
        currentAllocation,
        targetAllocation: currentAllocation * 0.7,
        reasoning: "Small-cap exposure exceeds recommended 25% limit for balanced portfolios.",
      };
    }

    // Underperforming fund detection
    if (fund.returns1Y < -10 && fund.riskLevel !== "low") {
      return {
        fundId: fund.id,
        fundName: fund.name,
        action: "exit",
        currentAllocation,
        targetAllocation: 0,
        reasoning: `${fund.name} has delivered ${fund.returns1Y.toFixed(1)}% in 1Y, significantly underperforming. Consider exiting.`,
      };
    }

    // High expense ratio with average returns
    if (fund.expenseRatio > 1.5 && fund.returns1Y < 12) {
      return {
        fundId: fund.id,
        fundName: fund.name,
        action: "reduce",
        currentAllocation,
        targetAllocation: currentAllocation * 0.5,
        reasoning: `Expense ratio of ${fund.expenseRatio}% is high relative to ${fund.returns1Y}% returns. Consider switching to a lower-cost alternative.`,
      };
    }

    return null;
  }

  /**
   * Calculate optimal dry powder deployment opportunity score
   */
  calculateDeploymentScore(state: QRPState, marketCondition: "bull" | "bear" | "sideways" | "volatile"): number {
    let score = 50; // Base score

    if (state.dryPowder > state.principalLayer * 0.15) score += 20; // Good dry powder
    if (marketCondition === "bear") score += 25; // Good time to deploy
    if (marketCondition === "bull") score -= 15; // Market already elevated
    if (state.totalReturnsPercent > 20) score -= 10; // Take some profits

    return Math.max(0, Math.min(100, score));
  }
}

// Singleton factory
export function createRebalanceEngine(config?: Partial<QRPConfig>): QuantRebalanceEngine {
  const defaultConfig: QRPConfig = {
    principalAmount: 0,
    alphaTriggerPercent: 12,
    drawbackPercent: 10,
    dryPowderPercent: 20,
    milestones: [10, 20, 30, 50, 75, 100],
  };

  return new QuantRebalanceEngine({ ...defaultConfig, ...config });
}
