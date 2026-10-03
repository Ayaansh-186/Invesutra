import { riskEngine } from "./riskEngine";
import { createRebalanceEngine } from "./rebalanceEngine";
import { allocationEngine } from "./allocationEngine";
import { formatCurrency, formatPercent } from "@/lib/utils/format";
import type { Portfolio } from "@/lib/types";

export function generateReport(portfolio: Portfolio) {
  const analysis = riskEngine.analyzePortfolio(portfolio);
  const engine = createRebalanceEngine();
  const rebalanceSuggestions = engine.generateRebalancingSuggestions(
    portfolio.funds,
    portfolio.currentValue
  );

  // Run the actual QuantRebalance Protocol against the current portfolio.
  // This correctly isolates each fund's Principal Layer before computing
  // Alpha — the pool is the full surplus above the restored principal
  // (Page 3 of the spec), not a percentage of the gain. The previous
  // version of this report computed `gain * alphaTriggerPercent%`, which
  // treated the trigger threshold as a capture rate and understated the
  // real Alpha Pool by ~88% against the spec's own worked example
  // (a ₹1,500 gain was reported as ₹180 of alpha).
  //
  // Prefer the recorded purchase date; legacy holdings use their date added.
  // The Time-Gated Multi-Trigger rule (Page 6) applies: lots under
  // 365 days use a 15% milestone (survives exit load + STCG tax on early
  // exit), lots past 365 days drop to 10% (zero exit load, LTCG-eligible).
  const fundsWithAge = portfolio.funds.map((f) => ({
    ...f,
    lotAgeDays: f.purchaseDate || f.createdAt
      ? Math.floor((Date.now() - new Date(f.purchases?.at(-1)?.date || f.purchaseDate || f.createdAt!).getTime()) / 86_400_000)
      : undefined,
  }));
  const protocolResult = engine.processPortfolioState(fundsWithAge);
  const alphaDeployment = protocolResult.netAlphaPool > 0 ? protocolResult.deploymentPlan : null;

  // Dry Powder preview — the QRP spec's other capital pool (Page 3). Unlike
  // the Alpha Pool above (which deploys against *any* fund in drawback),
  // Dry Powder is meant to sit in a liquid/debt instrument until a fund
  // crosses a deeper "structural correction point" (the spec's example:
  // an individual fund down 5%+ from cost basis), then sweep out to buy
  // that specific dip. This shows what a hypothetical reserve equal to
  // the current net alpha would do against today's portfolio — an
  // illustrative preview, since a real persisted reserve balance would
  // need to be tracked across actual rebalance events over time.
  const dryPowderPreview =
    protocolResult.netAlphaPool > 0
      ? allocationEngine.deployDryPowder(protocolResult.netAlphaPool, portfolio.funds, 5)
      : null;

  const returns = formatPercent(portfolio.returnsPercent);
  const value = formatCurrency(portfolio.currentValue, true);

  return {
    id: `RPT-${Date.now()}`,
    generatedAt: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    portfolio: portfolio.name,
    healthScore: portfolio.healthScore,
    overallHealth: analysis.overallHealth,
    summary: `${portfolio.name} holds ${portfolio.funds.length} funds with a total invested capital of ${formatCurrency(portfolio.totalInvested, true)}. Current portfolio value is ${value}, representing ${returns} overall returns. The portfolio scores ${portfolio.healthScore}/100 on health and ${portfolio.riskScore}/100 on risk.`,
    analysis,
    rebalanceSuggestions,
    alphaDeployment,
    dryPowderPreview,
    grossAlphaPool: protocolResult.alphaPool,
    netAlphaPool: protocolResult.netAlphaPool,
    frictionCost: protocolResult.totalFrictionCost,
    funds: portfolio.funds,
    riskMetrics: analysis.riskMetrics,
    allocationBreakdown: analysis.allocationBreakdown,
    issues: [
      ...analysis.concentrationRisk.map((r) => ({
        severity: r.severity,
        title: r.label,
        description: `Current exposure: ${r.currentPercent.toFixed(1)}%. Recommended maximum: ${r.recommendedMax}%.`,
      })),
      ...(analysis.underperformers.length > 0
        ? [
            {
              severity: "warning" as const,
              title: "Trailing-return screening flags",
              description: `${analysis.underperformers.length} fund(s) have low or negative trailing NAV returns under the local screening rules. No benchmark underperformance is established by this check.`,
            },
          ]
        : []),
    ],
    recommendations: [
      ...analysis.aiInsights,
      "Review your portfolio allocation quarterly to ensure it aligns with your financial goals.",
      "Consider consulting a SEBI-registered investment advisor before making significant changes.",
    ],
    algorithmExplanation: `The QuantRebalance Protocol (QRP) analyzes your portfolio using a multi-layer approach: (1) Principal Layer Protection ensures original capital is never eroded by rebalancing actions; (2) Alpha Pool extraction captures gains at predefined milestones (10%, 20%, 30%); (3) Weighted Drawback Allocation deploys captured alpha into the deepest value discounts across underperforming holdings; (4) Dry Powder Reserve maintains a liquid buffer for market correction opportunities. This systematic, emotion-free methodology is designed to compound wealth across market cycles without guaranteeing specific returns.`,
  };
}

export type GeneratedReport = ReturnType<typeof generateReport>;
