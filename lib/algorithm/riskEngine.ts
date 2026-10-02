import type { Fund, Portfolio, PortfolioAnalysis, ConcentrationRisk, RiskMetrics, AllocationBreakdown } from "../types";
import { createRebalanceEngine } from "./rebalanceEngine";
import { hasVerifiedMetric, hasVerifiedValue, isPortfolioDataReady } from "@/lib/marketData/quality";

export class RiskEngine {
  analyzePortfolio(portfolio: Portfolio): PortfolioAnalysis {
    const valuesReady = portfolio.valuationComplete !== false && portfolio.funds.every(fund =>
      hasVerifiedValue(fund) && Number.isFinite(fund.currentValue) && fund.currentValue > 0);
    const funds = valuesReady ? portfolio.funds : [];
    const totalValue = funds.reduce((sum, fund) => sum + fund.currentValue, 0);

    const allocationBreakdown = this.calculateAllocationBreakdown(funds, totalValue);
    const concentrationRisks = this.detectConcentrationRisks(allocationBreakdown);
    const riskMetrics: RiskMetrics = { beta: null, sharpeRatio: null, standardDeviation: null, maxDrawdown: null, valueAtRisk: null };
    const riskScore = this.calculateCategoryRisk(funds, totalValue);
    const diversificationScore = funds.length ? this.calculateDiversificationScore(allocationBreakdown, funds) : 0;
    const underperformers = this.detectUnderperformers(funds);
    const healthScore = funds.length ? this.calculateHealthScore(diversificationScore, concentrationRisks, riskScore, underperformers.length) : 0;
    const aiInsights = valuesReady && funds.length ? this.generateInsights(concentrationRisks, underperformers, allocationBreakdown) : ["Verify current NAV valuations before assessing allocation or risk."];
    const rebalancingSuggestions = isPortfolioDataReady(portfolio) ? createRebalanceEngine().generateRebalancingSuggestions(funds, totalValue) : [];

    return {
      healthScore, riskScore,
      overallHealth: this.scoreToHealth(healthScore),
      diversificationScore,
      concentrationRisk: concentrationRisks,
      underperformers,
      rebalancingSuggestions,
      aiInsights,
      allocationBreakdown,
      riskMetrics,
    };
  }

  private calculateAllocationBreakdown(funds: Fund[], totalValue: number): AllocationBreakdown {
    const byCategory: Record<string, number> = {};
    const byRisk: Record<string, number> = {};
    let large = 0;
    let mid = 0;
    let small = 0;
    let other = 0;

    for (const fund of funds) {
      const pct = totalValue > 0 ? (fund.currentValue / totalValue) * 100 : 0;

      byCategory[fund.category] = (byCategory[fund.category] || 0) + pct;
      byRisk[fund.riskLevel] = (byRisk[fund.riskLevel] || 0) + pct;

      if (["large_cap", "index"].includes(fund.category)) large += pct;
      else if (fund.category === "mid_cap") mid += pct;
      else if (fund.category === "small_cap") small += pct;
      else other += pct;
    }

    return { byCategory: byCategory as any, byRisk: byRisk as any, byMarketCap: { large, mid, small, other } };
  }

  private detectConcentrationRisks(breakdown: AllocationBreakdown): ConcentrationRisk[] {
    const risks: ConcentrationRisk[] = [];

    if (breakdown.byMarketCap.mid > 35) {
      risks.push({
        type: "market_cap",
        label: "Mid-Cap Overweight",
        currentPercent: breakdown.byMarketCap.mid,
        recommendedMax: 35,
        severity: breakdown.byMarketCap.mid > 50 ? "critical" : "warning",
      });
    }

    if (breakdown.byMarketCap.small > 25) {
      risks.push({
        type: "market_cap",
        label: "Small-Cap Overweight",
        currentPercent: breakdown.byMarketCap.small,
        recommendedMax: 25,
        severity: breakdown.byMarketCap.small > 40 ? "critical" : "warning",
      });
    }

    const sectoralPct = (breakdown.byCategory as any).sectoral || 0;
    if (sectoralPct > 20) {
      risks.push({
        type: "sector",
        label: "Sectoral Fund Concentration",
        currentPercent: sectoralPct,
        recommendedMax: 20,
        severity: "warning",
      });
    }

    for (const [cat, pct] of Object.entries(breakdown.byCategory)) {
      if (pct > 60) {
        risks.push({
          type: "category",
          label: `${cat.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())} Overexposure`,
          currentPercent: pct as number,
          recommendedMax: 60,
          severity: "critical",
        });
      }
    }

    return risks;
  }

  // A transparent category-based model score, not measured market volatility.
  private calculateCategoryRisk(funds: Fund[], totalValue: number): number {
    if (totalValue <= 0) return 0;
    const weights: Record<string, number> = { low: 20, moderate: 40, moderately_high: 60, high: 80, very_high: 100 };
    return Math.round(funds.reduce((score, fund) => score + (weights[fund.riskLevel] ?? 60) * fund.currentValue / totalValue, 0));
  }

  private calculateDiversificationScore(breakdown: AllocationBreakdown, funds: Fund[]): number {
    let score = 100;

    if (funds.length < 3) score -= 30;
    else if (funds.length < 5) score -= 15;

    const categoryValues = Object.values(breakdown.byCategory) as number[];
    const maxCategory = Math.max(...categoryValues, 0);
    if (maxCategory > 60) score -= 25;
    else if (maxCategory > 45) score -= 10;

    const debtPct = (breakdown.byCategory as any).debt || 0;
    const hybridPct = (breakdown.byCategory as any).hybrid || 0;
    if (debtPct + hybridPct < 10 && funds.length > 2) score -= 15;

    const categories = Object.keys(breakdown.byCategory).length;
    if (categories >= 4) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  private detectUnderperformers(funds: Fund[]): string[] {
    return funds
      .filter((fund) => hasVerifiedMetric(fund, "returns1Y") && (fund.returns1Y < 0 || (fund.returns1Y < 8 && fund.riskLevel !== "low")))
      .map((fund) => fund.id);
  }

  private calculateHealthScore(
    diversificationScore: number,
    risks: ConcentrationRisk[],
    riskScore: number,
    underperformerCount: number
  ): number {
    let score = diversificationScore * 0.8 + (100 - riskScore) * 0.2;

    const criticalRisks = risks.filter((risk) => risk.severity === "critical").length;
    const warningRisks = risks.filter((risk) => risk.severity === "warning").length;
    score -= criticalRisks * 15;
    score -= warningRisks * 7;

    score -= underperformerCount * 5;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private scoreToHealth(score: number): "excellent" | "good" | "fair" | "poor" {
    if (score >= 80) return "excellent";
    if (score >= 60) return "good";
    if (score >= 40) return "fair";
    return "poor";
  }

  private generateInsights(
    risks: ConcentrationRisk[],
    underperformerIds: string[],
    breakdown: AllocationBreakdown
  ): string[] {
    const insights: string[] = [];

    for (const risk of risks.slice(0, 3)) {
      insights.push(`${risk.label}: ${risk.currentPercent.toFixed(1)}% exposure exceeds the recommended ${risk.recommendedMax}% limit. Consider rebalancing.`);
    }

    if (underperformerIds.length > 0) {
      insights.push(`${underperformerIds.length} fund(s) have low or negative trailing NAV returns under the local screening rules. Compare the appropriate benchmarks before making a decision.`);
    }

    const debtPct = (breakdown.byCategory as any).debt || 0;
    if (debtPct < 10) {
      insights.push("Debt allocation is below 10%. Adding debt funds can reduce overall portfolio volatility and improve risk-adjusted returns.");
    }

    if (insights.length === 0) {
      insights.push("Portfolio structure looks healthy. Continue monitoring allocation on a quarterly basis.");
    }

    insights.push("Health and category-risk scores are model assessments. Historical beta, Sharpe, volatility, drawdown and VaR are unavailable without a validated portfolio return series and suitable benchmark.");
    return insights;
  }
}

export const riskEngine = new RiskEngine();
