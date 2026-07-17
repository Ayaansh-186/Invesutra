import { getAIChatCompletion, type AIProvider } from "./aiClient";
import { riskEngine } from "@/lib/algorithm/riskEngine";
import { createRebalanceEngine } from "@/lib/algorithm/rebalanceEngine";
import type { Portfolio } from "@/lib/types";

export interface AINarrativeInsight {
  title: string;
  body: string;
  tone: "positive" | "neutral" | "warning";
}

export interface AIAnalysisResult {
  source: AIProvider | "deterministic";
  summary: string;
  narrativeInsights: AINarrativeInsight[];
  healthScore: number;
  overallHealth: string;
  diversificationScore: number;
  riskMetrics: ReturnType<typeof riskEngine.analyzePortfolio>["riskMetrics"];
  concentrationRisk: ReturnType<typeof riskEngine.analyzePortfolio>["concentrationRisk"];
  rebalancingSuggestions: ReturnType<ReturnType<typeof createRebalanceEngine>["generateRebalancingSuggestions"]>;
}

function toneFromInsight(insight: string): AINarrativeInsight["tone"] {
  const normalized = insight.toLowerCase();
  if (normalized.includes("exceeds") || normalized.includes("high") || normalized.includes("underperform")) return "warning";
  if (normalized.includes("healthy") || normalized.includes("good")) return "positive";
  return "neutral";
}

function buildDeterministicNarrative(
  portfolio: Portfolio,
  analysis: ReturnType<typeof riskEngine.analyzePortfolio>,
  rebalancingSuggestions: ReturnType<ReturnType<typeof createRebalanceEngine>["generateRebalancingSuggestions"]>
): Pick<AIAnalysisResult, "summary" | "narrativeInsights"> {
  const totalValue = portfolio.currentValue || portfolio.totalInvested || 1;
  const topRisk = analysis.concentrationRisk[0];
  const debtPct = analysis.allocationBreakdown.byCategory.debt || 0;
  const hybridPct = analysis.allocationBreakdown.byCategory.hybrid || 0;
  const underperformerCount = analysis.underperformers.length;
  const topHolding = [...portfolio.funds].sort((a, b) => b.currentValue - a.currentValue)[0];
  const topHoldingText = topHolding
    ? `${topHolding.name} is the largest holding at ${((topHolding.currentValue / totalValue) * 100).toFixed(1)}%.`
    : "No holdings have been added yet.";
  const milestoneAlpha = portfolio.funds.reduce((sum, fund) => {
    if (fund.investedAmount <= 0) return sum;
    const gainPercent = ((fund.currentValue - fund.investedAmount) / fund.investedAmount) * 100;
    return gainPercent >= 10 ? sum + Math.max(0, fund.currentValue - fund.investedAmount) : sum;
  }, 0);

  const summary = `Local deterministic analysis rates this portfolio as ${analysis.overallHealth} with a ${portfolio.healthScore}/100 health score, ${analysis.diversificationScore}/100 diversification score, and ${portfolio.riskScore}/100 risk score. ${topRisk ? `The largest alert is ${topRisk.label.toLowerCase()} at ${topRisk.currentPercent.toFixed(1)}%.` : "No critical concentration alert is currently active."}`;

  const narrativeInsights: AINarrativeInsight[] = [
    {
      title: "Portfolio Structure",
      body: `${topHoldingText} Defensive allocation through debt and hybrid funds is ${(debtPct + hybridPct).toFixed(1)}%, which affects how much cushion the portfolio has during corrections.`,
      tone: debtPct + hybridPct < 10 ? "warning" : "neutral",
    },
    {
      title: "Risk And Concentration",
      body: topRisk
        ? `${topRisk.label} exceeds the ${topRisk.recommendedMax}% guide, so the next rebalance should reduce concentration before adding more aggressive exposure.`
        : `Risk is mainly driven by beta ${analysis.riskMetrics.beta.toFixed(2)} and estimated max drawdown ${analysis.riskMetrics.maxDrawdown.toFixed(1)}%, with no major concentration breach detected.`,
      tone: topRisk ? "warning" : "positive",
    },
    {
      title: "QuantRebalance Readiness",
      body: milestoneAlpha > 0
        ? `The rules detect roughly Rs. ${Math.round(milestoneAlpha).toLocaleString("en-IN")} of unrealized milestone alpha that could be reviewed for principal isolation and weighted drawback deployment.`
        : "No holding has crossed the 10% milestone-alpha review band yet, so the protocol would keep monitoring rather than force a profit-booking event.",
      tone: milestoneAlpha > 0 ? "positive" : "neutral",
    },
    {
      title: "Action Priority",
      body: rebalancingSuggestions[0]
        ? `First rule-based action: ${rebalancingSuggestions[0].action} ${rebalancingSuggestions[0].fundName}. ${rebalancingSuggestions[0].reasoning}`
        : `No mandatory rebalance is flagged. Continue watching ${underperformerCount} underperforming fund${underperformerCount === 1 ? "" : "s"} and review category weights periodically.`,
      tone: rebalancingSuggestions[0] || underperformerCount > 0 ? "warning" : "positive",
    },
  ];

  return { summary, narrativeInsights };
}
export async function analyzePortfolioWithAI(portfolio: Portfolio): Promise<AIAnalysisResult> {
  const analysis = riskEngine.analyzePortfolio(portfolio);
  const engine = createRebalanceEngine();
  const rebalancingSuggestions = engine.generateRebalancingSuggestions(portfolio.funds, portfolio.currentValue);

  const deterministicNarrative = buildDeterministicNarrative(portfolio, analysis, rebalancingSuggestions);
  const deterministicResult: AIAnalysisResult = {
    source: "deterministic",
    ...deterministicNarrative,
    healthScore: portfolio.healthScore,
    overallHealth: analysis.overallHealth,
    diversificationScore: analysis.diversificationScore,
    riskMetrics: analysis.riskMetrics,
    concentrationRisk: analysis.concentrationRisk,
    rebalancingSuggestions,
  };

  const hasAnyProvider =
    process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

  if (!hasAnyProvider) {
    return deterministicResult;
  }

  try {
    const groundingData = {
      portfolioName: portfolio.name,
      fundCount: portfolio.funds.length,
      totalInvested: portfolio.totalInvested,
      currentValue: portfolio.currentValue,
      returnsPercent: portfolio.returnsPercent,
      healthScore: portfolio.healthScore,
      overallHealth: analysis.overallHealth,
      diversificationScore: analysis.diversificationScore,
      riskMetrics: analysis.riskMetrics,
      concentrationRisks: analysis.concentrationRisk,
      underperformerCount: analysis.underperformers.length,
      allocationByCategory: analysis.allocationBreakdown.byCategory,
      rebalancingSuggestions: rebalancingSuggestions.map((suggestion) => ({
        fund: suggestion.fundName,
        action: suggestion.action,
        reasoning: suggestion.reasoning,
      })),
    };

    const { text: raw, provider } = await getAIChatCompletion(
      [
        {
          role: "system",
          content:
            'You are a portfolio analysis writer for Invesutra, an Indian mutual fund decision-support platform built around the QuantRebalance Protocol. You will be given pre-computed deterministic analysis data. Your job is only to write a clear, professional narrative explaining that data. Never invent numbers, percentages, financial figures, holdings overlap, or future returns. Always note that this is informational, not investment advice. Respond with strict JSON: { "summary": string, "insights": [{ "title": string, "body": string, "tone": "positive" | "neutral" | "warning" }] }. Produce 3 to 5 insights, each 1-2 sentences, written for a retail investor.',
        },
        {
          role: "user",
          content: `Here is the deterministic portfolio analysis data:\n\n${JSON.stringify(groundingData, null, 2)}\n\nWrite the summary and insights JSON now.`,
        },
      ],
      { jsonMode: true }
    );

    if (!raw) return deterministicResult;

    const parsed = JSON.parse(raw) as { summary: string; insights: AINarrativeInsight[] };

    return {
      ...deterministicResult,
      source: provider,
      summary: parsed.summary || deterministicResult.summary,
      narrativeInsights: parsed.insights?.length ? parsed.insights : deterministicResult.narrativeInsights,
    };
  } catch (error) {
    console.error("AI analysis failed, falling back to deterministic engine:", error);
    return deterministicResult;
  }
}
