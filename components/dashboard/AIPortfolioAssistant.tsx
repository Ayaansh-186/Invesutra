"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import {
  Loader2, Send, Plus, List,
  Shield, TrendingUp, RefreshCw, Search, Sparkle,
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
  initialQuery,
  historyEnabled,
}: {
  portfolio: Portfolio;
  analysis: PortfolioAnalysis;
  onAddFund: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
  initialQuery?: string;
  /** True when this is a real, signed-in-owned portfolio — enables loading/saving chat history so it survives a page reload. Omit/false for demo sessions. */
  historyEnabled?: boolean;
}) {
  const greeting = `Hi! I'm **Invesutra AI**, your portfolio copilot. I've analyzed your ${portfolio.funds.length} fund${portfolio.funds.length === 1 ? "" : "s"} worth ${formatCurrency(portfolio.currentValue, true)}.\n\n• Health: **${portfolio.healthScore}/100** (${analysis.overallHealth})\n• Risk: **${portfolio.riskScore}/100**\n• Returns: **${formatPercent(portfolio.returnsPercent)}**\n\nAsk me anything — risk drivers, fund performance, rebalancing, or say "add a fund" to manage holdings.`;

  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: greeting }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"groq" | "gemini" | "openai" | "deterministic" | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);

  const hasStarted = messages.some((m) => m.role === "user");

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

  const firedInitialQuery = useRef(false);
  // "idle" until we know whether there's saved history to load. When
  // historyEnabled is false (demo sessions), there's nothing to wait for.
  const [historyStatus, setHistoryStatus] = useState<"idle" | "loading" | "ready">(
    historyEnabled ? "loading" : "ready"
  );

  useEffect(() => {
    if (!historyEnabled) {
      setHistoryStatus("ready");
      return;
    }

    let cancelled = false;
    setHistoryStatus("loading");

    fetch(`/api/portfolios/${portfolio.id}/chat`)
      .then((res) => (res.ok ? res.json() : { messages: [] }))
      .then((data: { messages?: ChatMessage[] }) => {
        if (cancelled) return;
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        }
      })
      .catch(() => {
        // Fail soft — keep the default greeting if history can't be loaded.
      })
      .finally(() => {
        if (!cancelled) setHistoryStatus("ready");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyEnabled, portfolio.id]);

  useEffect(() => {
    if (historyStatus !== "ready") return;
    if (initialQuery && !hasStarted && !firedInitialQuery.current) {
      firedInitialQuery.current = true;
      askAssistant(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, historyStatus, hasStarted]);

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
      setInput("");
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
      setInput("");
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

      // The AI may have added/updated/removed a fund via a tool call —
      // refresh so the rest of the dashboard reflects it.
      if (data.portfolioChanged) {
        onRefresh();
      }
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
        return <strong key={i} className="font-semibold text-[var(--shell-text)]">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  }

  function BigInput({ inputEl, autoFocus }: { inputEl: React.RefObject<HTMLInputElement | null>; autoFocus?: boolean }) {
    return (
      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          askAssistant(input);
        }}
      >
        <input
          ref={inputEl}
          autoFocus={autoFocus}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about risk, funds, allocation, or say 'add a fund'..."
          className="w-full rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-surface)] py-4 pl-5 pr-14 text-[15px] text-[var(--shell-text)] outline-none placeholder:text-[var(--shell-text-faint)] transition focus:border-cyan-500/40"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="absolute right-2.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 shrink-0 items-center justify-center rounded-full bg-[var(--shell-text)] text-[var(--shell-bg)] transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </button>
      </form>
    );
  }

  if (historyStatus !== "ready") {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--shell-text-faint)]" />
      </div>
    );
  }

  // ---- Fresh conversation: minimal centered hero with a single input ----
  if (!hasStarted) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden">
        <div className="shrink-0 flex items-center justify-end gap-2 px-5 py-4">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="rounded-lg p-2 text-[var(--shell-text-faint)] transition hover:bg-[var(--shell-surface-2)] hover:text-[var(--shell-text)] disabled:opacity-50"
            title="Refresh portfolio"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 pb-16 pt-4">
          <div className="w-full max-w-2xl">
            <div className="mb-7 flex flex-col items-center text-center">
              <Sparkle className="mb-3 h-6 w-6 text-cyan-600" strokeWidth={1.5} />
              <h1 className="text-xl font-medium text-[var(--shell-text)]">Hi, I'm Invesutra AI</h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--shell-text-muted)]">
                {renderMessageContent(greeting)}
              </p>
            </div>

            <BigInput inputEl={heroInputRef} autoFocus />

            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleQuickAction(action)}
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--shell-border)] px-3 py-1.5 text-xs text-[var(--shell-text-muted)] transition hover:border-[var(--shell-text-faint)] hover:text-[var(--shell-text)] disabled:opacity-50"
                >
                  <action.icon className="h-3 w-3" strokeWidth={1.5} />
                  {action.label}
                </button>
              ))}
            </div>

            <div className="mt-8">
              <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-wider text-[var(--shell-text-faint)]">
                Suggested
              </p>
              <div className="flex flex-col items-center gap-1">
                {STARTER_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => askAssistant(q)}
                    className="text-sm text-[var(--shell-text-muted)] transition hover:text-[var(--shell-text)] hover:underline underline-offset-4"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Ongoing conversation: minimal transcript with a pinned input ----
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--shell-border)] px-5 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkle className="h-4 w-4 text-cyan-600" strokeWidth={1.5} />
            <div>
              <h1 className="text-sm font-medium text-[var(--shell-text)]">Invesutra AI</h1>
              <p className="text-xs text-[var(--shell-text-faint)]">{assistantBrief}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="rounded-lg p-2 text-[var(--shell-text-faint)] transition hover:bg-[var(--shell-surface-2)] hover:text-[var(--shell-text)] disabled:opacity-50"
              title="Refresh portfolio"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onAddFund}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--shell-text-muted)] transition hover:bg-[var(--shell-surface-2)] hover:text-[var(--shell-text)]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add fund
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`}>
              {message.role === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl bg-[var(--shell-surface-2)] px-4 py-2.5 text-[15px] leading-relaxed text-[var(--shell-text)]">
                    {renderMessageContent(message.content)}
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Sparkle className="mt-1 h-4 w-4 shrink-0 text-cyan-600" strokeWidth={1.5} />
                  <div className="min-w-0 flex-1 text-[15px] leading-relaxed text-[var(--shell-text)]">
                    {renderMessageContent(message.content)}
                  </div>
                </div>
              )}

              {message.action === "show_holdings" && portfolio.funds.length > 0 && (
                <div className="mt-3 ml-7 space-y-2">
                  {[...portfolio.funds]
                    .sort((a, b) => b.currentValue - a.currentValue)
                    .map((fund) => (
                      <div
                        key={fund.id}
                        className="flex items-center justify-between rounded-xl border border-[var(--shell-border)] px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[var(--shell-text)]">{fund.name}</p>
                          <p className="text-xs text-[var(--shell-text-faint)]">
                            {categoryLabel(fund.category)} · {formatPercent(fund.returns1Y)} 1Y
                          </p>
                        </div>
                        <div className="ml-3 text-right">
                          <p className="text-sm font-semibold text-[var(--shell-text)]">{formatCurrency(fund.currentValue, true)}</p>
                          <p className="text-xs text-[var(--shell-text-faint)]">
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
            <div className="flex items-center gap-3 text-sm text-[var(--shell-text-faint)]">
              <Sparkle className="h-4 w-4 text-cyan-600" strokeWidth={1.5} />
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Thinking...
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Pinned input */}
      <div className="shrink-0 px-5 pb-4 pt-2">
        <div className="mx-auto max-w-3xl">
          <BigInput inputEl={inputRef} />
          {source && (
            <p className="mt-2 text-[10px] text-[var(--shell-text-faint)]">
              {source === "groq"
                ? "Groq · grounded on portfolio data"
                : source === "gemini"
                ? "Gemini · grounded on portfolio data"
                : source === "openai"
                ? "OpenAI · grounded on portfolio data"
                : "Local deterministic engine"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
