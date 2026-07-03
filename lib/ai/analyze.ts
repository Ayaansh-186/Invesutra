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

export async function analyzePortfolioWithAI(portfolio: Portfolio): Promise<AIAnalysisResult> {
  const analysis = riskEngine.analyzePortfolio(portfolio);
  const engine = createRebalanceEngine();
  const rebalancingSuggestions = engine.generateRebalancingSuggestions(portfolio.funds, portfolio.currentValue);

  const deterministicResult: AIAnalysisResult = {
    source: "deterministic",
    summary: analysis.aiInsights[0] || "Portfolio analysis complete.",
    narrativeInsights: analysis.aiInsights.map((insight) => ({
      title: "Insight",
      body: insight,
      tone: toneFromInsight(insight),
    })),
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
