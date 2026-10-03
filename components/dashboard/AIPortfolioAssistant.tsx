"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2, Send, Plus, RefreshCw, Sparkle, ShieldCheck,
} from "lucide-react";
import type { Portfolio, PortfolioAnalysis } from "@/lib/types";
import { formatCurrency, formatPercent, categoryLabel } from "@/lib/utils/format";
import ValuationStatus from "./ValuationStatus";
import { hasVerifiedValue, isPortfolioDataReady } from "@/lib/marketData/quality";
import AIConsentDialog from "@/components/shared/AIConsentDialog";
import { answerHoldingQuestion, detectPortfolioIntent } from "@/lib/ai/holdingAnswer";
import { DETAILED_AI_CONSENT_VERSION, readAIPrivacyPreference, saveAIPrivacyPreference } from "@/lib/ai/privacy";
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  action?: "show_holdings" | "add_fund" | "manage_holdings" | null;
}

// Defined at module scope (not inside AIPortfolioAssistant) so its component
// identity is stable across renders. Defining a component function inside
// another component's body creates a brand-new type on every render, which
// makes React unmount+remount the underlying <input> DOM node every time —
// exactly what was causing focus loss / cursor jumps on every keystroke.
function ChatInputBar({
  inputEl,
  autoFocus,
  value,
  onChange,
  onSubmit,
  loading,
}: {
  inputEl: React.RefObject<HTMLInputElement | null>;
  autoFocus?: boolean;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  return (
    <form
      className="relative"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <input
        ref={inputEl}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ask about risk, funds, allocation, or say 'add a fund'..."
        className="w-full rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-surface)] py-4 pl-5 pr-14 text-[15px] text-[var(--shell-text)] shadow-sm outline-none placeholder:text-[var(--shell-text-faint)] transition focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-400/10"
      />
      <button
        type="submit"
        disabled={loading || !value.trim()}
        className="absolute right-2.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 shrink-0 items-center justify-center rounded-full bg-[var(--shell-text)] text-[var(--shell-bg)] transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
      </button>
    </form>
  );
}

const STARTER_QUESTIONS = [
  "What needs my attention first?",
  "Explain my biggest risk",
  "How could I improve my allocation?",
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
  const greeting = `I can help explain your ${portfolio.funds.length} holding${portfolio.funds.length === 1 ? "" : "s"}, risks, and possible next steps. Changes to holdings are confirmed on the Portfolio page.`;

  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: greeting }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [onlineConsent, setOnlineConsent] = useState<boolean | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const privacyScope = `${portfolio.userId}:${portfolio.id}`;
  const consentScope = useRef<{ scope: string; online: boolean | null }>({ scope: privacyScope, online: null });
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  useEffect(() => {
    let choice: boolean | null = null;
    try { choice = historyEnabled ? readAIPrivacyPreference(localStorage, portfolio.userId, portfolio.id) : null; } catch { /* No persisted consent without storage. */ }
    consentScope.current = { scope: privacyScope, online: choice };
    setOnlineConsent(choice);
    setPendingQuestion(null); setPreferenceError(null);
  }, [privacyScope, historyEnabled, portfolio.userId, portfolio.id]);
  function resetPrivacy() {
    consentScope.current = { scope: privacyScope, online: null };
    setOnlineConsent(null);
    try { if (!saveAIPrivacyPreference(localStorage, portfolio.userId, portfolio.id, null)) setPreferenceError("Could not clear the saved preference on this device."); }
    catch { setPreferenceError("Could not clear the saved preference on this device."); }
  }
  const [source, setSource] = useState<"groq" | "gemini" | "openai" | "deterministic" | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);

  const hasStarted = messages.some((m) => m.role === "user");

  const assistantBrief = useMemo(() => {
    if (!isPortfolioDataReady(portfolio)) return "Review unverified holdings on the Portfolio page";
    const firstRisk = analysis.concentrationRisk[0];
    if (firstRisk) {
      return `${firstRisk.label}: ${firstRisk.currentPercent.toFixed(1)}% vs ${firstRisk.recommendedMax}% guide`;
    }
    if (analysis.underperformers.length > 0) {
      return `${analysis.underperformers.length} fund${analysis.underperformers.length === 1 ? "" : "s"} need review`;
    }
    return `Diversification ${analysis.diversificationScore}/100`;
  }, [analysis, portfolio]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const firedInitialQuery = useRef<string | null>(null);
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
    if (initialQuery && firedInitialQuery.current !== initialQuery) {
      firedInitialQuery.current = initialQuery;
      askAssistant(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, historyStatus]);

  function detectLocalIntent(question: string): "add_fund" | "show_holdings" | "manage_holdings" | null {
    return detectPortfolioIntent(question);
  }

  function localFallbackReply(question: string): string {
    const holdingAnswer = answerHoldingQuestion(portfolio, question, messages);
    if (holdingAnswer) return holdingAnswer;
    if (!isPortfolioDataReady(portfolio)) return "Some NAVs or purchase costs are unverified. Review the flagged holdings on Portfolio before using gain, allocation, or investment suggestions.";
    const lower = question.toLowerCase();
    const firstRisk = analysis.concentrationRisk[0];
    const topHolding = [...portfolio.funds].sort((a, b) => b.currentValue - a.currentValue)[0];

    if (lower.includes("risk")) {
      return firstRisk
        ? `The cloud assistant is unavailable, so here is the local read: **${firstRisk.label}** is the biggest risk at **${firstRisk.currentPercent.toFixed(1)}%** versus the **${firstRisk.recommendedMax}%** guide. Your overall risk score is **${portfolio.riskScore}/100**.`
        : `The cloud assistant is unavailable. The local category-risk model score is **${portfolio.riskScore}/100**. Historical beta and drawdown are unavailable; they are not inferred from fund categories.`;
    }

    if (lower.includes("divers") || lower.includes("allocation")) {
      return `The cloud assistant is unavailable, so here is the local read: diversification is **${analysis.diversificationScore}/100**. Largest holding: **${topHolding?.name || "none"}**. Keep category concentration controlled before adding more aggressive funds.`;
    }

    if (lower.includes("holding") || lower.includes("fund")) {
      return `The cloud assistant is unavailable, so here is the local read: you have **${portfolio.funds.length}** fund${portfolio.funds.length === 1 ? "" : "s"}. Current value is **${formatCurrency(portfolio.currentValue, true)}**, with total return of **${formatPercent(portfolio.returnsPercent)}**.`;
    }

    return "The online assistant is unavailable, and I could not reliably match that message to a local check. Do you mean a holding's loss, its risk, your monthly SIP plan, or your overall portfolio? Name the holding for a focused answer.";
  }
  async function askAssistant(question: string, consentOverride?: boolean) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    const localIntent = detectLocalIntent(trimmed);

    if (localIntent === "add_fund") {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: trimmed },
        {
          role: "assistant",
          content: "I'll open Add Fund so you can confirm the exact scheme, allotment date and units. Nothing is saved until you confirm the purchase.",
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

    if (localIntent === "manage_holdings") {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: trimmed },
        { role: "assistant", content: "Open Portfolio to review and confirm changes to your holding or monthly SIP plan. A plan changes intended contributions only, not purchased units or invested amounts. Nothing has been changed through chat.", action: "manage_holdings" },
      ]);
      setInput("");
      return;
    }

    let consent = consentOverride ?? (consentScope.current.scope === privacyScope ? consentScope.current.online : null);
    if (consent === null && historyEnabled) {
      try { consent = readAIPrivacyPreference(localStorage, portfolio.userId, portfolio.id); } catch { /* Storage can be unavailable. */ }
    }
    if (consent === null) { setPendingQuestion(trimmed); return; }
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setSource(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/portfolio-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolio, messages: nextMessages, allowPrivateAI: consent,
          privateAIConsentVersion: consent ? DETAILED_AI_CONSENT_VERSION : undefined }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessages([...nextMessages, { role: "assistant", content: data.error || "I couldn't load your portfolio right now. Please try again." }]);
        return;
      }

      setSource(data.source || null);
      setMessages([...nextMessages, { role: "assistant", content: data.answer }]);

    } catch {
      setSource("deterministic");
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: localFallbackReply(trimmed),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const consentDialog = <><AIConsentDialog canRemember={historyEnabled} open={pendingQuestion !== null} onClose={() => setPendingQuestion(null)} onChoose={(online, remember) => {
    const question = pendingQuestion;
    setOnlineConsent(online);
    consentScope.current = { scope: privacyScope, online };
    try {
      const saved = saveAIPrivacyPreference(localStorage, portfolio.userId, portfolio.id, remember && historyEnabled ? online : null);
      setPreferenceError(saved ? null : "Your choice applies to this visit, but could not be remembered on this device.");
    } catch { setPreferenceError("Your choice applies to this visit, but could not be remembered on this device."); }
    setPendingQuestion(null);
    if (question) void askAssistant(question, online);
  }} />{preferenceError && <p role="alert" className="text-xs text-amber-600">{preferenceError}</p>}</>;

  // ── Inline renderer: **bold** and *italic* ──────────────────────────────
  function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
    return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return (
          <strong key={`${keyPrefix}-b${i}`} className="font-semibold text-[var(--shell-text)]">
            {part.slice(2, -2)}
          </strong>
        );
      if (part.startsWith("*") && part.endsWith("*"))
        return (
          <em key={`${keyPrefix}-i${i}`} className="italic text-[var(--shell-text-muted)]">
            {part.slice(1, -1)}
          </em>
        );
      return <span key={`${keyPrefix}-t${i}`}>{part}</span>;
    });
  }

  // ── Full message renderer ─────────────────────────────────────────────────
  // Handles: numbered lists (1. 2.), bullet lists (- •), paragraphs,
  // **bold**, *italic*. Pipe table rows are stripped so they never render
  // as broken text even if the model emits them.
  function renderMessageContent(raw: string) {
    // Strip any pipe-table rows the model might emit
    const content = raw
      .split("\n")
      .filter((l) => !/^\s*\|.*\|/.test(l) && !/^\s*[-|:]+\s*$/.test(l))
      .join("\n");

    type Block = { type: "p" | "ol" | "ul"; lines: string[] };
    const blocks: Block[] = [];

    for (const chunk of content.split(/\n{2,}/)) {
      const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
      if (!lines.length) continue;
      const allNumbered = lines.every((l) => /^\d+\.\s/.test(l));
      const allBullet   = lines.every((l) => /^[-•*]\s/.test(l));

      if (allNumbered) {
        blocks.push({ type: "ol", lines: lines.map((l) => l.replace(/^\d+\.\s/, "")) });
      } else if (allBullet) {
        blocks.push({ type: "ul", lines: lines.map((l) => l.replace(/^[-•*]\s/, "")) });
      } else {
        blocks.push({ type: "p", lines });
      }
    }

    return (
      <div className="space-y-3">
        {blocks.map((block, bi) => {
          if (block.type === "ol")
            return (
              <ol key={bi} className="list-none space-y-2">
                {block.lines.map((line, li) => (
                  <li key={li} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[var(--shell-surface-2)] text-[10px] font-bold text-[var(--shell-text-muted)]">
                      {li + 1}
                    </span>
                    <span className="leading-relaxed">{renderInline(line, `b${bi}l${li}`)}</span>
                  </li>
                ))}
              </ol>
            );
          if (block.type === "ul")
            return (
              <ul key={bi} className="space-y-1.5">
                {block.lines.map((line, li) => (
                  <li key={li} className="flex items-start gap-2">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--shell-text-faint)]" />
                    <span className="leading-relaxed">{renderInline(line, `b${bi}l${li}`)}</span>
                  </li>
                ))}
              </ul>
            );
          return (
            <p key={bi} className="leading-relaxed">
              {block.lines.map((line, li) => (
                <span key={li}>
                  {li > 0 && <br />}
                  {renderInline(line, `b${bi}l${li}`)}
                </span>
              ))}
            </p>
          );
        })}
      </div>
    );
  }

  // ── MCQ parser ────────────────────────────────────────────────────────────
  // Detects when the AI ends a reply with "Reply with a number to confirm"
  // and extracts the numbered options so we can render them as click buttons.
  function parseMCQ(content: string): { preamble: string; options: string[] } | null {
    const trigger = /reply with (a|the) number/i;
    if (!trigger.test(content)) return null;

    const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
    const options: string[] = [];
    const preamble: string[] = [];
    let seenFirst = false;

    for (const line of lines) {
      const m = line.match(/^(\d+)\.\s+(.*)/);
      if (m) {
        seenFirst = true;
        options.push(m[2]);
      } else if (!seenFirst) {
        preamble.push(line);
      }
      // lines after options (the "Reply with a number" prompt) are omitted —
      // we replace them with the button row
    }

    return options.length >= 2 ? { preamble: preamble.join("\n"), options } : null;
  }

  if (historyStatus !== "ready") {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--shell-text-faint)]" />
      </div>
    );
  }

  // ---- Fresh conversation: one useful summary and a question input ----
  if (!hasStarted) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden">
        {consentDialog}
        <div className="shrink-0 flex items-center justify-end gap-2 px-5 py-4">
          <button title="Change AI privacy choice" aria-label="Change AI privacy choice" onClick={resetPrivacy} className="app-icon-button"><ShieldCheck className="h-4 w-4" /></button>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="rounded-lg p-2 text-[var(--shell-text-faint)] transition hover:bg-[var(--shell-surface-2)] hover:text-[var(--shell-text)] disabled:opacity-50"
            title="Refresh portfolio"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 pb-12 pt-4">
          <div className="w-full max-w-2xl">
            <div className="mb-7">
              <h1 className="text-2xl font-semibold text-[var(--shell-text)]">Ask Invesutra</h1>
              <p className="mt-2 text-sm text-[var(--shell-text-muted)]">Understand your portfolio and decide what to review next.</p>
              <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-y border-[var(--shell-border)] py-4 text-sm">
                <span className="text-[var(--shell-text-muted)]">NAV value <strong className="ml-1 text-[var(--shell-text)]">{portfolio.valuationComplete === false ? "Unavailable" : formatCurrency(portfolio.currentValue, true)}</strong></span>
                <span className="text-[var(--shell-text-muted)]">Return <strong className="ml-1 text-[var(--shell-text)]">{isPortfolioDataReady(portfolio) ? formatPercent(portfolio.returnsPercent) : "Unverified"}</strong></span>
                <span className="text-[var(--shell-text-muted)]">Holdings <strong className="ml-1 text-[var(--shell-text)]">{portfolio.funds.length}</strong></span>
              </div>
              <ValuationStatus portfolio={portfolio} />
            </div>

            <ChatInputBar
              inputEl={heroInputRef}
              autoFocus
              value={input}
              onChange={setInput}
              onSubmit={() => askAssistant(input)}
              loading={loading}
            />

            <div className="mt-5">
              <p className="mb-2 text-xs font-medium text-[var(--shell-text-faint)]">Try asking</p>
              <div className="flex flex-col items-start gap-2">
                {STARTER_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => askAssistant(q)}
                    className="text-left text-sm text-[var(--shell-text-muted)] transition hover:text-[var(--shell-text)] hover:underline underline-offset-4"
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
      {consentDialog}
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
            <button title="Change AI privacy choice before your next question" aria-label="Change AI privacy choice" onClick={resetPrivacy} className="app-icon-button"><ShieldCheck className="h-4 w-4" /></button>
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
          <ValuationStatus portfolio={portfolio} />
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className="animate-sprout">
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
                    {(() => {
                      const mcq = index === messages.length - 1 ? parseMCQ(message.content) : null;
                      if (mcq) {
                        return (
                          <div className="space-y-3">
                            {mcq.preamble && renderMessageContent(mcq.preamble)}
                            <div className="mt-2 flex flex-col gap-2">
                              {mcq.options.map((opt, oi) => (
                                <button
                                  key={oi}
                                  disabled={loading}
                                  style={{ animationDelay: `${0.06 * oi + 0.08}s` }}
                                  onClick={() => askAssistant(String(oi + 1))}
                                  className="flex animate-sprout items-center gap-3 rounded-xl border border-[var(--shell-border)] bg-[var(--shell-surface)] px-4 py-2.5 text-left text-[14px] transition-all hover:-translate-y-0.5 hover:border-cyan-500/40 hover:bg-[var(--shell-surface-2)] hover:shadow-sm disabled:opacity-50"
                                >
                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--shell-border)] text-[11px] font-semibold text-[var(--shell-text-muted)]">
                                    {oi + 1}
                                  </span>
                                  <span className="flex-1 text-[var(--shell-text)]">
                                    {renderInline(opt, `mcq-${index}-${oi}`)}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return renderMessageContent(message.content);
                    })()}
                  </div>
                </div>
              )}

              {message.action === "show_holdings" && portfolio.funds.length > 0 && (
                <div className="mt-3 ml-7 space-y-2">
                  {[...portfolio.funds]
                    .sort((a, b) => b.currentValue - a.currentValue)
                    .map((fund, fi) => (
                      <div
                        key={fund.id}
                        style={{ animationDelay: `${0.05 * fi + 0.06}s` }}
                        className="flex animate-sprout items-center justify-between rounded-xl border border-[var(--shell-border)] px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[var(--shell-text)]">{fund.name}</p>
                          <p className="text-xs text-[var(--shell-text-faint)]">
                            {categoryLabel(fund.category)} · {formatPercent(fund.returns1Y)} 1Y
                          </p>
                        </div>
                        <div className="ml-3 text-right">
                          <p className="text-sm font-semibold text-[var(--shell-text)]">{hasVerifiedValue(fund) ? formatCurrency(fund.currentValue, true) : "NAV unavailable"}</p>
                          <p className="text-xs text-[var(--shell-text-faint)]">
                            {portfolio.currentValue > 0 ? ((fund.currentValue / portfolio.currentValue) * 100).toFixed(1) : "0.0"}%
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
              {message.action === "manage_holdings" && (
                <Link href="/portfolio" className="ml-7 mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-600 hover:underline">
                  Open portfolio
                </Link>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex animate-sprout items-center gap-3">
              <Sparkle className="h-4 w-4 shrink-0 text-cyan-600" strokeWidth={1.5} />
              <div className="flex items-center gap-2 rounded-2xl bg-[var(--shell-surface-2)] px-3.5 py-2.5">
                <span className="flex items-center gap-1 text-cyan-600">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Pinned input */}
      <div className="shrink-0 px-5 pb-4 pt-2">
        <div className="mx-auto max-w-3xl">
          <ChatInputBar
            inputEl={inputRef}
            value={input}
            onChange={setInput}
            onSubmit={() => askAssistant(input)}
            loading={loading}
          />
          {source && (
            <p className="mt-2 text-[10px] text-[var(--shell-text-faint)]">
              {source === "deterministic"
                ? "Built-in portfolio analysis"
                : "Live AI response based on your portfolio"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
