import { getAIChatCompletion, type AIProvider } from "./aiClient";
import { riskEngine } from "@/lib/algorithm/riskEngine";
import { createRebalanceEngine } from "@/lib/algorithm/rebalanceEngine";
import { categoryLabel, formatCurrency, formatPercent } from "@/lib/utils/format";
import type { Portfolio } from "@/lib/types";

export interface PortfolioChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PortfolioAssistantResponse {
  source: AIProvider | "deterministic";
  answer: string;
  suggestedQuestions: string[];
}

function getTopAllocations(portfolio: Portfolio) {
  const total = portfolio.currentValue || portfolio.totalInvested || 1;
  return [...portfolio.funds]
    .sort((a, b) => b.currentValue - a.currentValue)
    .slice(0, 5)
    .map((fund) => ({
      name: fund.name,
      category: categoryLabel(fund.category),
      allocation: Number(((fund.currentValue / total) * 100).toFixed(1)),
      returns1Y: fund.returns1Y,
      riskLevel: fund.riskLevel.replace(/_/g, " "),
      expenseRatio: fund.expenseRatio,
    }));
}

function fallbackAnswer(portfolio: Portfolio, question: string): string {
  const analysis = riskEngine.analyzePortfolio(portfolio);
  const topRisk = analysis.concentrationRisk[0];
  const debtPct = analysis.allocationBreakdown.byCategory.debt || 0;
  const smallPct = analysis.allocationBreakdown.byMarketCap.small;
  const midPct = analysis.allocationBreakdown.byMarketCap.mid;
  const underperformers = portfolio.funds.filter((fund) => analysis.underperformers.includes(fund.id));
  const lower = question.toLowerCase();

  if (lower.includes("risk")) {
    const riskReason = topRisk
      ? `${topRisk.label.toLowerCase()} is ${topRisk.currentPercent.toFixed(1)}%, above the ${topRisk.recommendedMax}% guide.`
      : `beta is ${analysis.riskMetrics.beta.toFixed(2)} and estimated drawdown is ${analysis.riskMetrics.maxDrawdown.toFixed(1)}%.`;
    return `Your portfolio risk score is ${portfolio.riskScore}/100. The main driver is that ${riskReason} Mid-cap exposure is ${midPct.toFixed(1)}% and small-cap exposure is ${smallPct.toFixed(1)}%, so the assistant would first reduce concentration before adding more aggressive funds.`;
  }

  if (lower.includes("health") || lower.includes("score")) {
    return `Your health score is ${portfolio.healthScore}/100, which currently reads as ${analysis.overallHealth}. The score is shaped by diversification (${analysis.diversificationScore}/100), risk metrics like beta ${analysis.riskMetrics.beta.toFixed(2)}, and ${underperformers.length} underperforming fund${underperformers.length === 1 ? "" : "s"}.`;
  }

  if (lower.includes("divers") || lower.includes("allocation")) {
    return `Your diversification score is ${analysis.diversificationScore}/100. Debt allocation is ${debtPct.toFixed(1)}%, mid-cap exposure is ${midPct.toFixed(1)}%, and small-cap exposure is ${smallPct.toFixed(1)}%. A steadier mix would usually add defensive allocation and avoid any one category dominating the portfolio.`;
  }

  if (lower.includes("improve") || lower.includes("rebalance")) {
    const suggestions = createRebalanceEngine().generateRebalancingSuggestions(portfolio.funds, portfolio.currentValue);
    if (suggestions.length === 0) {
      return `The portfolio does not need a major rebalance based on the current rules. I would keep monitoring category weights, expense ratios, and whether any fund stays below its peer return band for multiple review cycles.`;
    }
    return `The clearest improvement is to ${suggestions[0].action} ${suggestions[0].fundName} from ${suggestions[0].currentAllocation.toFixed(1)}% toward ${suggestions[0].targetAllocation.toFixed(1)}%. Reason: ${suggestions[0].reasoning}`;
  }

  if (lower.includes("perform") || lower.includes("return")) {
    const laggards = underperformers.map((fund) => fund.name).slice(0, 3);
    return `The portfolio return is ${formatPercent(portfolio.returnsPercent)} on ${formatCurrency(portfolio.totalInvested, true)} invested. ${laggards.length ? `Funds to review first: ${laggards.join(", ")}.` : "No major underperformer is currently flagged by the rules."}`;
  }

  return `I reviewed your current portfolio data: ${portfolio.funds.length} funds, ${formatCurrency(portfolio.currentValue, true)} current value, ${formatPercent(portfolio.returnsPercent)} total return, health score ${portfolio.healthScore}/100, and risk score ${portfolio.riskScore}/100. Ask me about risk, diversification, fund performance, or how to improve the allocation.`;
}

export async function answerPortfolioQuestion(
  portfolio: Portfolio,
  messages: PortfolioChatMessage[]
): Promise<PortfolioAssistantResponse> {
  const analysis = riskEngine.analyzePortfolio(portfolio);
  const latestQuestion = messages.filter((m) => m.role === "user").at(-1)?.content?.trim() || "";
  const suggestedQuestions = [
    "Why is my portfolio risk high?",
    "How can I improve diversification?",
    "Which fund should I review first?",
  ];

  const hasAnyProvider =
    process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

  if (!hasAnyProvider) {
    return {
      source: "deterministic",
      answer: fallbackAnswer(portfolio, latestQuestion),
      suggestedQuestions,
    };
  }

  const groundingData = {
    portfolio: {
      name: portfolio.name,
      fundCount: portfolio.funds.length,
      totalInvested: portfolio.totalInvested,
      currentValue: portfolio.currentValue,
      returnsPercent: portfolio.returnsPercent,
      healthScore: portfolio.healthScore,
      riskScore: portfolio.riskScore,
    },
    topAllocations: getTopAllocations(portfolio),
    analysis: {
      overallHealth: analysis.overallHealth,
      diversificationScore: analysis.diversificationScore,
      allocationByCategory: analysis.allocationBreakdown.byCategory,
      marketCapExposure: analysis.allocationBreakdown.byMarketCap,
      concentrationRisk: analysis.concentrationRisk,
      riskMetrics: analysis.riskMetrics,
      underperformers: portfolio.funds
        .filter((fund) => analysis.underperformers.includes(fund.id))
        .map((fund) => ({ name: fund.name, returns1Y: fund.returns1Y, category: fund.category })),
    },
  };

  try {
    const { text: answer, provider } = await getAIChatCompletion([
      {
        role: "system",
        content:
          "You are Sutra AI, the portfolio copilot inside Invesutra for Indian mutual fund investors. Answer only from the supplied portfolio data. Explain health score, risk, diversification, fund performance, and improvements in plain English. Help users manage their mutual fund holdings — they can add funds, review holdings, and ask about rebalancing through this chat. Do not invent live market prices, holdings overlap, fund facts, or future returns. If data is missing, say what would be needed. This is educational decision support, not investment advice.",
      },
      {
        role: "user",
        content: `Portfolio data:\n${JSON.stringify(groundingData, null, 2)}`,
      },
      ...messages.slice(-8).map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ]);

    return { source: provider, answer, suggestedQuestions };
  } catch (error) {
    console.error("Portfolio assistant failed, falling back:", error);
    return {
      source: "deterministic",
      answer: fallbackAnswer(portfolio, latestQuestion),
      suggestedQuestions,
    };
  }
}
