// Copyright © 2026 Ayaansh Singhal. All Rights Reserved.

import {
  getAIChatCompletion,
  getAIChatCompletionWithTools,
  TOOL_CALLING_PROVIDERS,
  type AIProvider,
  type ChatTurn,
} from "./aiClient";
import { riskEngine } from "@/lib/algorithm/riskEngine";
import { createRebalanceEngine } from "@/lib/algorithm/rebalanceEngine";
import { categoryLabel, formatCurrency, formatPercent } from "@/lib/utils/format";
import type { Portfolio } from "@/lib/types";
import { executeTool, getAvailableTools, type ToolExecutionContext } from "./tools";

export interface PortfolioChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PortfolioAssistantResponse {
  source: AIProvider | "deterministic";
  answer: string;
  suggestedQuestions: string[];
  /** True if a tool call in this turn added/updated/removed a fund — the caller should refresh the portfolio. */
  portfolioChanged: boolean;
}

function getTopAllocations(portfolio: Portfolio) {
  const total = portfolio.currentValue || portfolio.totalInvested || 1;
  return [...portfolio.funds]
    .sort((a, b) => b.currentValue - a.currentValue)
    .slice(0, 5)
    .map((fund) => ({
      id: fund.id,
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
  const engine = createRebalanceEngine();
  const totalValue = portfolio.currentValue || portfolio.totalInvested || 1;
  const topRisk = analysis.concentrationRisk[0];
  const debtPct = analysis.allocationBreakdown.byCategory.debt || 0;
  const hybridPct = analysis.allocationBreakdown.byCategory.hybrid || 0;
  const smallPct = analysis.allocationBreakdown.byMarketCap.small;
  const midPct = analysis.allocationBreakdown.byMarketCap.mid;
  const underperformers = portfolio.funds.filter((fund) => analysis.underperformers.includes(fund.id));
  const suggestions = engine.generateRebalancingSuggestions(portfolio.funds, totalValue);
  const topHoldings = [...portfolio.funds]
    .sort((a, b) => b.currentValue - a.currentValue)
    .slice(0, 3)
    .map((fund) => `${fund.name} (${((fund.currentValue / totalValue) * 100).toFixed(1)}%)`);
  const eligibleAlpha = portfolio.funds
    .filter((fund) => fund.investedAmount > 0)
    .reduce((sum, fund) => {
      const gainPercent = ((fund.currentValue - fund.investedAmount) / fund.investedAmount) * 100;
      return gainPercent >= 10 ? sum + Math.max(0, fund.currentValue - fund.investedAmount) : sum;
    }, 0);
  const lower = question.toLowerCase();

  if (lower.includes("qrp") || lower.includes("quant") || lower.includes("alpha") || lower.includes("dry powder")) {
    const dryPowderNote = eligibleAlpha > 0
      ? `About ${formatCurrency(eligibleAlpha, true)} of unrealized gain is currently eligible for alpha-capture review at a 10%+ milestone.`
      : "No holding is currently showing enough milestone gain for alpha capture under the 10% review band.";
    return `Using the local QuantRebalance rules, I would preserve each fund's core principal layer, capture only milestone alpha, then route that alpha toward funds trading below cost basis. ${dryPowderNote} If no fund is in drawdown, the rules keep fresh alpha as dry powder instead of forcing it into elevated holdings.`;
  }

  if (lower.includes("risk")) {
    const riskReason = topRisk
      ? `${topRisk.label.toLowerCase()} is ${topRisk.currentPercent.toFixed(1)}%, above the ${topRisk.recommendedMax}% guide`
      : `beta is ${analysis.riskMetrics.beta.toFixed(2)} with estimated max drawdown of ${analysis.riskMetrics.maxDrawdown.toFixed(1)}%`;
    return `Your portfolio risk score is ${portfolio.riskScore}/100. Main driver: ${riskReason}. Mid-cap exposure is ${midPct.toFixed(1)}%, small-cap is ${smallPct.toFixed(1)}%, and debt plus hybrid is ${(debtPct + hybridPct).toFixed(1)}%, so the first risk-control move is reducing concentration before adding more aggressive funds.`;
  }

  if (lower.includes("health") || lower.includes("score")) {
    return `Your health score is ${portfolio.healthScore}/100 (${analysis.overallHealth}). The local engine is weighing diversification at ${analysis.diversificationScore}/100, beta at ${analysis.riskMetrics.beta.toFixed(2)}, Sharpe at ${analysis.riskMetrics.sharpeRatio.toFixed(2)}, ${analysis.concentrationRisk.length} concentration alert${analysis.concentrationRisk.length === 1 ? "" : "s"}, and ${underperformers.length} underperforming fund${underperformers.length === 1 ? "" : "s"}.`;
  }

  if (lower.includes("divers") || lower.includes("allocation")) {
    return `Diversification score: ${analysis.diversificationScore}/100. Largest holdings: ${topHoldings.length ? topHoldings.join(", ") : "none yet"}. Debt is ${debtPct.toFixed(1)}%, mid-cap is ${midPct.toFixed(1)}%, and small-cap is ${smallPct.toFixed(1)}%. A steadier mix usually avoids one category dominating and keeps some defensive allocation available for corrections.`;
  }

  if (lower.includes("improve") || lower.includes("rebalance") || lower.includes("suggest")) {
    if (suggestions.length === 0) {
      return `The local rules do not see a major mandatory rebalance right now. Keep monitoring category weights, expense ratios, and funds that stay below peer-return bands for multiple review cycles. The next useful check is whether any winning position has crossed a 10%-15% alpha-capture milestone.`;
    }
    const ranked = suggestions.slice(0, 3).map((suggestion, index) => `${index + 1}. ${suggestion.action} ${suggestion.fundName} from ${suggestion.currentAllocation.toFixed(1)}% toward ${suggestion.targetAllocation.toFixed(1)}%: ${suggestion.reasoning}`);
    return `Top local rebalancing moves:\n\n${ranked.join("\n")}`;
  }

  if (lower.includes("perform") || lower.includes("return") || lower.includes("review")) {
    const laggards = underperformers.map((fund) => `${fund.name} (${formatPercent(fund.returns1Y)} 1Y)`).slice(0, 3);
    return `Portfolio return is ${formatPercent(portfolio.returnsPercent)} on ${formatCurrency(portfolio.totalInvested, true)} invested. ${laggards.length ? `Review these first: ${laggards.join(", ")}.` : "No major underperformer is currently flagged by the local rules."} Current Sharpe estimate is ${analysis.riskMetrics.sharpeRatio.toFixed(2)}.`;
  }

  return `Local deterministic review: ${portfolio.funds.length} funds, ${formatCurrency(portfolio.currentValue, true)} current value, ${formatPercent(portfolio.returnsPercent)} total return, health ${portfolio.healthScore}/100, risk ${portfolio.riskScore}/100. The main watchpoints are ${topRisk ? topRisk.label.toLowerCase() : "category balance"}, ${underperformers.length} underperformer${underperformers.length === 1 ? "" : "s"}, and whether winners have crossed QRP alpha-capture milestones.`;
}

function systemPrompt(canMutate: boolean, hasTools: boolean): string {
  const base =
    "You are Invesutra AI, the portfolio copilot for Indian mutual fund investors. Answer only from the " +
    "supplied portfolio data and tool results. Explain health score, risk, diversification, fund performance, and " +
    "improvements in plain English. Do not invent live market prices, holdings overlap, fund facts, or future " +
    "returns — use the search_mutual_funds / get_fund_details tools for real fund data instead of guessing. This is " +
    "educational decision support, not investment advice. " +
    "RESPONSE FORMAT RULES (follow exactly): " +
    "(1) NEVER output markdown pipe tables (no | col | rows — they break the UI). " +
    "(2) When listing multiple funds or options, use numbered lists: " +
    "'1. **Fund Name** — Category, X% allocation, Y% 1Y return'. " +
    "(3) Use **bold** only for fund names, scores, and key figures. " +
    "(4) Use dash bullets (- item) for short lists that are not fund options. " +
    "(5) Separate paragraphs with a blank line (two newlines). " +
    "(6) Keep answers concise — under 130 words unless the user asks for detail. " +
    "QUESTION FORMAT: When you need the user to choose between options (e.g. which fund to remove/edit), " +
    "present each option as a numbered list then end with exactly: 'Reply with a number to confirm.' " +
    "Example: '1. **HDFC Balanced Fund** — Hybrid, 39.2%\n2. **HDFC Large Cap** — Large-Cap, 21.6%\n\nReply with a number to confirm.'";

  if (!hasTools) return base;

  if (!canMutate) {
    return (
      base +
      " You have read-only fund search tools (search_mutual_funds, get_fund_details) backed by AMFI data. You do " +
      "NOT have tools to add/remove funds in this session (the user isn't signed in or hasn't selected a saved " +
      "portfolio) — if asked to add or remove a fund, explain that and suggest signing in."
    );
  }

  return (
    base +
    " You can search real mutual funds (search_mutual_funds, get_fund_details) and manage the user's own tracked " +
    "Invesutra portfolio (add_fund_to_portfolio, update_fund_holding, remove_fund_from_portfolio) — this updates " +
    "their portfolio tracker only, it does not place any real brokerage order. Look up real fund data before " +
    "adding a fund when you can. Always confirm which fund and amount before adding, and confirm before removing " +
    "a holding."
  );
}

async function runToolLoop(
  portfolio: Portfolio,
  messages: PortfolioChatMessage[],
  groundingData: unknown,
  toolContext: ToolExecutionContext
): Promise<{ answer: string; provider: AIProvider; portfolioChanged: boolean }> {
  const tools = getAvailableTools(toolContext);
  const conversation: ChatTurn[] = [
    { role: "system", content: systemPrompt(toolContext.canMutate, true) },
    { role: "user", content: `Portfolio data:\n${JSON.stringify(groundingData, null, 2)}` },
    ...messages.slice(-8).map((m) => ({ role: m.role, content: m.content } as ChatTurn)),
  ];

  let portfolioChanged = false;
  const MAX_TOOL_ROUNDS = 4;
  const seenMutationCalls = new Set<string>();

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const { text, provider, toolCalls } = await getAIChatCompletionWithTools(conversation, tools);

    if (!toolCalls || toolCalls.length === 0) {
      return { answer: text, provider, portfolioChanged };
    }

    conversation.push({ role: "assistant", content: text, toolCalls });

    for (const call of toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.arguments || "{}");
      } catch {
        // leave args empty — executeTool will validate required fields
      }

      // Guard against the model repeating the exact same mutation call
      // (e.g. add_fund_to_portfolio with identical args) across rounds,
      // which would otherwise add/remove the same fund more than once.
      const isMutation = call.name !== "search_mutual_funds" && call.name !== "get_fund_details";
      const callKey = `${call.name}:${call.arguments}`;
      if (isMutation && seenMutationCalls.has(callKey)) {
        conversation.push({
          role: "tool",
          toolCallId: call.id,
          name: call.name,
          content: JSON.stringify({
            error: "This exact action already ran in this turn — do not repeat it. Answer the user now.",
          }),
        });
        continue;
      }
      if (isMutation) seenMutationCalls.add(callKey);

      const outcome = await executeTool(call.name, args, toolContext).catch((error: unknown) => ({
        result: { error: error instanceof Error ? error.message : "Tool call failed" },
        portfolioChanged: false,
      }));
      if (outcome.portfolioChanged) portfolioChanged = true;
      conversation.push({
        role: "tool",
        toolCallId: call.id,
        name: call.name,
        content: JSON.stringify(outcome.result),
      });
    }
  }

  // Ran out of tool rounds. The conversation history already contains
  // assistant tool-call turns, so this final request MUST still declare
  // the tools (Groq/OpenAI reject a request whose history has tool calls
  // but no tools attached) — we just force tool_choice "none" so the
  // model has to answer in plain text instead of calling anything else.
  const { text: answer, provider } = await getAIChatCompletionWithTools(conversation, tools, {
    toolChoice: "none",
  });
  return { answer, provider, portfolioChanged };
}

export async function answerPortfolioQuestion(
  portfolio: Portfolio,
  messages: PortfolioChatMessage[],
  toolContext?: ToolExecutionContext
): Promise<PortfolioAssistantResponse> {
  const analysis = riskEngine.analyzePortfolio(portfolio);
  const latestQuestion = messages.filter((m) => m.role === "user").at(-1)?.content?.trim() || "";
  const suggestedQuestions = [
    "Why is my portfolio risk high?",
    "How can I improve diversification?",
    "Which fund should I review first?",
    "Find a large cap fund for me",
  ];

  const hasAnyProvider =
    process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

  if (!hasAnyProvider) {
    return {
      source: "deterministic",
      answer: fallbackAnswer(portfolio, latestQuestion),
      suggestedQuestions,
      portfolioChanged: false,
    };
  }

  const groundingData = {
    portfolio: {
      id: portfolio.id,
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
        .map((fund) => ({ id: fund.id, name: fund.name, returns1Y: fund.returns1Y, category: fund.category })),
    },
  };

  const PROVIDER_ENV_KEYS: Record<AIProvider, string | undefined> = {
    groq: process.env.GROQ_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    openai: process.env.OPENAI_API_KEY,
  };
  const canUseTools =
    Boolean(toolContext) && TOOL_CALLING_PROVIDERS.some((p) => Boolean(PROVIDER_ENV_KEYS[p]));

  try {
    if (canUseTools && toolContext) {
      try {
        const { answer, provider, portfolioChanged } = await runToolLoop(portfolio, messages, groundingData, toolContext);
        return { source: provider, answer, suggestedQuestions, portfolioChanged };
      } catch (toolError) {
        console.error("Tool-capable AI path failed, retrying normal provider chain:", toolError);
      }
    }

    const { text: answer, provider } = await getAIChatCompletion([
      { role: "system", content: systemPrompt(false, false) },
      { role: "user", content: `Portfolio data:\n${JSON.stringify(groundingData, null, 2)}` },
      ...messages.slice(-8).map((message) => ({ role: message.role, content: message.content })),
    ]);

    return { source: provider, answer, suggestedQuestions, portfolioChanged: false };
  } catch (error) {
    console.error("Portfolio assistant failed, falling back:", error);
    return {
      source: "deterministic",
      answer: fallbackAnswer(portfolio, latestQuestion),
      suggestedQuestions,
      portfolioChanged: false,
    };
  }
}
