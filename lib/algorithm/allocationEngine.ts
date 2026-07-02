/**
 * Allocation Engine
 * TypeScript implementation of the QuantRebalance Protocol's Weighted
 * Drawback Vector — the capital redistribution layer described in
 * MutualFundAlgorithm.md, Page 3: "Advanced Capital Redistribution Logic".
 *
 * When an Alpha Pool is captured from a profit-booking event, this engine
 * decides where that capital goes:
 *   1. If one or more funds are trading below their cost basis, the pool is
 *      deployed proportionally to the most distressed funds first (the
 *      "Weighted Drawback Vector").
 *   2. If no fund is in drawdown (e.g. a strongly correlated bull market),
 *      the pool is swept into the Dry Powder reserve instead of being
 *      forced into already-overvalued assets.
 */

import type { Fund } from "../types";

export interface DrawbackEntry {
  fundId: string;
  fundName: string;
  drawbackPercent: number; // positive number, e.g. 10 means -10% from cost basis
}

export interface AllocationDeployment {
  fundId: string;
  fundName: string;
  drawbackPercent: number;
  weight: number; // 0–1, this fund's share of the total drawback
  capitalDeployed: number;
}

export interface AllocationResult {
  totalAlphaPool: number;
  totalSystemicDrawback: number;
  deployments: AllocationDeployment[];
  sweptToDryPowder: number;
  routedVia: "weighted_drawback_vector" | "dry_powder_sweep";
}

export class AllocationEngine {
  /**
   * Computes each fund's percentage drawback relative to its own cost basis.
   * D_i = max(0, (costBasis - currentValue) / costBasis)
   * Mirrors the formula on Page 3 of the algorithm spec.
   */
  computeDrawbacks(funds: Fund[]): DrawbackEntry[] {
    return funds
      .map((fund) => {
        const costBasis = fund.investedAmount;
        if (costBasis <= 0) return { fundId: fund.id, fundName: fund.name, drawbackPercent: 0 };
        const drawback = Math.max(0, ((costBasis - fund.currentValue) / costBasis) * 100);
        return { fundId: fund.id, fundName: fund.name, drawbackPercent: drawback };
      })
      .filter((entry) => entry.drawbackPercent > 0);
  }

  /**
   * Deploys a captured Alpha Pool according to the Weighted Drawback Vector:
   *
   *   Capital Deployment to Fund i = AlphaPool × (D_i / ΣD_j)
   *
   * If no fund is in drawdown, the entire pool is routed to Dry Powder
   * instead — matching the "Dry Powder Storage Layer" rule in the spec.
   */
  deployAlphaPool(alphaPool: number, funds: Fund[]): AllocationResult {
    const drawbacks = this.computeDrawbacks(funds);
    const totalSystemicDrawback = drawbacks.reduce((sum, d) => sum + d.drawbackPercent, 0);

    if (drawbacks.length === 0 || totalSystemicDrawback === 0) {
      return {
        totalAlphaPool: alphaPool,
        totalSystemicDrawback: 0,
        deployments: [],
        sweptToDryPowder: alphaPool,
        routedVia: "dry_powder_sweep",
      };
    }

    const deployments: AllocationDeployment[] = drawbacks.map((entry) => {
      const weight = entry.drawbackPercent / totalSystemicDrawback;
      return {
        fundId: entry.fundId,
        fundName: entry.fundName,
        drawbackPercent: parseFloat(entry.drawbackPercent.toFixed(2)),
        weight: parseFloat(weight.toFixed(4)),
        capitalDeployed: parseFloat((alphaPool * weight).toFixed(2)),
      };
    });

    return {
      totalAlphaPool: alphaPool,
      totalSystemicDrawback: parseFloat(totalSystemicDrawback.toFixed(2)),
      deployments,
      sweptToDryPowder: 0,
      routedVia: "weighted_drawback_vector",
    };
  }

  /**
   * Convenience helper matching the spec's worked example exactly:
   * given an alpha pool and a list of (fund, drawback%) pairs, returns the
   * deployment amounts. Useful for tests / documentation parity checks.
   */
  static fromWorkedExample(alphaPool: number, drawbacks: DrawbackEntry[]): AllocationDeployment[] {
    const total = drawbacks.reduce((sum, d) => sum + d.drawbackPercent, 0);
    if (total === 0) return [];
    return drawbacks.map((d) => ({
      fundId: d.fundId,
      fundName: d.fundName,
      drawbackPercent: d.drawbackPercent,
      weight: d.drawbackPercent / total,
      capitalDeployed: alphaPool * (d.drawbackPercent / total),
    }));
  }
}

export const allocationEngine = new AllocationEngine();
