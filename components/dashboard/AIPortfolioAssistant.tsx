"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import {
  Bot, Loader2, Send, Sparkles, UserRound, Plus, List,
  Shield, TrendingUp, RefreshCw, Search, ChevronRight,
} from "lucide-react";
import type { Portfolio, PortfolioAnalysis } from "@/lib/types";
import { formatCurrency, formatPercent, categoryLabel } from "@/lib/utils/format";
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  action?: "show_holdings" | "add_fund" | null;
}

const STARTER_QUESTIONS = [
  "Why is my portfolio risk high?",
  "How can I improve diversification?",
  "Which fund should I review first?",
  "Show me my holdings breakdown",
  "What's my health score telling me?",
];

const QUICK_ACTIONS = [
  { label: "Analyze risk", icon: Shield, query: "Why is my portfolio risk high?" },
  { label: "Show holdings", icon: List, query: "Show me my holdings breakdown" },
  { label: "Add a fund", icon: Plus, action: "add_fund" as const },
  { label: "Improve allocation", icon: TrendingUp, query: "How can I improve diversification?" },
  { label: "Find funds", icon: Search, href: "/screener" },
];

export default function AIPortfolioAssistant({
  portfolio,
  analysis,
  onAddFund,
  onRefresh,
  refreshing,
}: {
  portfolio: Portfolio;
  analysis: PortfolioAnalysis;
  onAddFund: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Hi! I'm **Sutra**, your Invesutra portfolio copilot. I've analyzed your ${portfolio.funds.length} fund${portfolio.funds.length === 1 ? "" : "s"} worth ${formatCurrency(portfolio.currentValue, true)}.\n\n• Health: **${portfolio.healthScore}/100** (${analysis.overallHealth})\n• Risk: **${portfolio.riskScore}/100**\n• Returns: **${formatPercent(portfolio.returnsPercent)}**\n\nAsk me anything — risk drivers, fund performance, rebalancing, or say "add a fund" to manage holdings.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"groq" | "gemini" | "openai" | "deterministic" | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const assistantBrief = useMemo(() => {
    const firstRisk = analysis.concentrationRisk[0];
    if (firstRisk) {
      return `${firstRisk.label}: ${firstRisk.currentPercent.toFixed(1)}% vs ${firstRisk.recommendedMax}% guide`;
    }
    if (analysis.underperformers.length > 0) {
      return `${analysis.underperformers.length} fund${analysis.underperformers.length === 1 ? "" : "s"} need review`;
    }
    return `Diversification ${analysis.diversificationScore}/100`;
  }, [analysis]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function detectLocalIntent(question: string): "add_fund" | "show_holdings" | null {
    const q = question.toLowerCase();
    if (q.includes("add fund") || q.includes("add a fund") || q.includes("new fund")) return "add_fund";
    if (q.includes("show holding") || q.includes("my holding") || q.includes("list fund") || q.includes("holdings breakdown")) return "show_holdings";
    return null;
  }

  async function askAssistant(question: string) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    const localIntent = detectLocalIntent(trimmed);

    if (localIntent === "add_fund") {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: trimmed },
        {
          role: "assistant",
          content: "I'll open the fund manager so you can add a new mutual fund holding. Fill in the fund details and I'll include it in your next analysis.",
          action: "add_fund",
        },
      ]);
      onAddFund();
      return;
    }

    if (localIntent === "show_holdings") {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: trimmed },
        {
          role: "assistant",
          content: portfolio.funds.length === 0
            ? "You don't have any funds yet. Say **add a fund** or click the button below to get started."
            : `Here are your **${portfolio.funds.length} holdings** sorted by value:`,
          action: "show_holdings",
        },
      ]);
      return;
    }

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/portfolio-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolio, messages: nextMessages }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Assistant failed");

      setSource(data.source || null);
      setMessages([...nextMessages, { role: "assistant", content: data.answer }]);
    } catch (error) {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: error instanceof Error
            ? `I couldn't complete that analysis: ${error.message}`
            : "I couldn't complete that analysis right now. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleQuickAction(action: typeof QUICK_ACTIONS[number]) {
    if ("href" in action && action.href) {
      window.location.href = action.href;
      return;
    }
    if ("action" in action && action.action === "add_fund") {
      askAssistant("Add a fund to my portfolio");
      return;
    }
    if ("query" in action && action.query) {
      askAssistant(action.query);
    }
  }

  function renderMessageContent(content: string) {
    return content.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-white/10 bg-[#0c1829] px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-emerald-400 text-slate-950 shadow-lg shadow-cyan-500/20">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-white">Sutra AI</h1>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                  Online
                </span>
              </div>
              <p className="text-xs text-slate-400">Portfolio copilot · {assistantBrief}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
              title="Refresh portfolio"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onAddFund}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Fund
            </button>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => handleQuickAction(action)}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-white disabled:opacity-50"
            >
              <action.icon className="h-3 w-3" />
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`}>
              <div className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}>
                {message.role === "assistant" && (
                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-400/20">
                    <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "bg-cyan-400/20 text-cyan-50 border border-cyan-400/20"
                      : "border border-white/10 bg-white/[0.04] text-slate-300"
                  }`}
                >
                  {renderMessageContent(message.content)}
                </div>
                {message.role === "user" && (
                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-slate-400">
                    <UserRound className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>

              {message.action === "show_holdings" && portfolio.funds.length > 0 && (
                <div className="ml-10 mt-3 space-y-2">
                  {[...portfolio.funds]
                    .sort((a, b) => b.currentValue - a.currentValue)
                    .map((fund) => (
                      <div
                        key={fund.id}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">{fund.name}</p>
                          <p className="text-xs text-slate-500">
                            {categoryLabel(fund.category)} · {formatPercent(fund.returns1Y)} 1Y
                          </p>
                        </div>
                        <div className="ml-3 text-right">
                          <p className="text-sm font-semibold text-white">{formatCurrency(fund.currentValue, true)}</p>
                          <p className="text-xs text-slate-500">
                            {((fund.currentValue / portfolio.currentValue) * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-400/20">
                <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                Sutra is analyzing your portfolio...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Suggested questions */}
      {messages.length <= 2 && !loading && (
        <div className="shrink-0 border-t border-white/10 px-5 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Suggested questions</p>
          <div className="flex flex-wrap gap-2">
            {STARTER_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => askAssistant(q)}
                className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400 transition hover:border-cyan-400/30 hover:text-white"
              >
                {q}
                <ChevronRight className="h-3 w-3 opacity-50" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form
        className="shrink-0 border-t border-white/10 bg-[#0c1829] p-4"
        onSubmit={(e) => {
          e.preventDefault();
          askAssistant(input);
        }}
      >
        <div className="mx-auto flex max-w-3xl gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about risk, funds, allocation, or say 'add a fund'..."
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 transition focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-emerald-400 text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        {source && (
          <p className="mx-auto mt-2 max-w-3xl text-[10px] text-slate-600">
            Source:{" "}
            {source === "groq"
              ? "Groq · grounded on portfolio data"
              : source === "gemini"
              ? "Gemini · grounded on portfolio data"
              : source === "openai"
              ? "OpenAI · grounded on portfolio data"
              : "Local deterministic engine"}
          </p>
        )}
      </form>
    </div>
  );
}
