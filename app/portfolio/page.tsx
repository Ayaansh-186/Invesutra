"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { riskEngine } from "@/lib/algorithm/riskEngine";
import { useActivePortfolio } from "@/lib/hooks/useActivePortfolio";
import { useAuth } from "@/lib/hooks/useAuth";
import { formatCurrency, formatPercent, getHealthColor } from "@/lib/utils/format";
import HoldingsTable from "@/components/dashboard/HoldingsTable";
import MilestoneTracker from "@/components/dashboard/MilestoneTracker";
import SinceLastVisit from "@/components/dashboard/SinceLastVisit";
import ValuationStatus from "@/components/dashboard/ValuationStatus";
import { isPortfolioDataReady } from "@/lib/marketData/quality";
import type { Fund } from "@/lib/types";
import {
  Sparkles, Plus, RefreshCw, TrendingUp, TrendingDown, MessageSquare, AlertTriangle, ChevronDown,
} from "lucide-react";

// Only loaded when the user actually opens "Add Fund" — keeps this ~19KB
// form out of the initial bundle for the most-visited page in the app.
const AddFundModal = dynamic(() => import("@/components/dashboard/AddFundModal"), { ssr: false });

export default function PortfolioPage() {
  const { user } = useAuth();
  const { portfolio, loading, isDemo, isEmpty, error, refresh } = useActivePortfolio();
  const [showAddFund, setShowAddFund] = useState(false);
  const [holdingToRepair, setHoldingToRepair] = useState<Fund | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const analysis = portfolio.analysis ?? riskEngine.analyzePortfolio(portfolio);
  const dataReady = isPortfolioDataReady(portfolio);
  const returnsUp = portfolio.returnsPercent >= 0;
  const primaryRisk = analysis.concentrationRisk[0];
  const firstSuggestion = analysis.rebalancingSuggestions[0];
  const attentionText = !dataReady ? "Some holdings need NAV or purchase verification. Review the marked rows before relying on returns or allocation suggestions." : primaryRisk
    ? `${primaryRisk.label} is ${primaryRisk.currentPercent.toFixed(1)}% of your portfolio, above the ${primaryRisk.recommendedMax}% guide.`
    : firstSuggestion
      ? `${firstSuggestion.fundName} may need an allocation review.`
      : "No major concentration issue is flagged right now.";
  const attentionQuestion = primaryRisk
    ? `Explain my ${primaryRisk.label} exposure and what I should review first.`
    : firstSuggestion
      ? `Explain why ${firstSuggestion.fundName} may need an allocation review.`
      : "What should I review first in my portfolio?";

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshNotice(null);
    try {
      let complete = false;
      if (user && !isDemo && !isEmpty && portfolio.id) {
        const response = await fetch(`/api/portfolios/${portfolio.id}/refresh`, { method: "POST" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Live values could not be refreshed.");
        setRefreshNotice(
          result.updated > 0
            ? `Updated ${result.updated} of ${result.total} fund${result.total === 1 ? "" : "s"} from live NAV data.`
            : "Live NAV data was unavailable. Your saved values were kept unchanged."
        );
        complete = result.updated === result.total;
      }
      await refresh();
      return complete;
    } catch (refreshError) {
      setRefreshNotice(refreshError instanceof Error ? refreshError.message : "Refresh failed.");
      return false;
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin" />
          <Sparkles className="absolute inset-0 m-auto h-5 w-5 text-cyan-400" />
        </div>
        <p className="text-sm text-[var(--shell-text-muted)]">Loading your portfolio...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Status banners */}
      {isDemo && !user && (
        <div className="shrink-0 flex items-center gap-3 border-b border-cyan-400/20 bg-cyan-400/10 px-4 py-2.5">
          <Sparkles className="h-4 w-4 shrink-0 text-cyan-400" />
          <p className="flex-1 text-xs text-[var(--shell-text-muted)]">
            Exploring with sample data.{" "}
            <Link href="/auth/signup" className="font-semibold text-cyan-500 hover:underline">
              Sign up free
            </Link>{" "}
            to add your real holdings.
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4 sm:mb-8">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-[var(--shell-text)]">{error && user && !portfolio.funds.length ? "Portfolio" : portfolio.name}</h1>
              <p className="mt-1 text-sm text-[var(--shell-text-muted)]">
                {error && user && !portfolio.funds.length ? "Your holdings could not be loaded" : isEmpty && user ? "No holdings yet" : `${portfolio.funds.length} fund${portfolio.funds.length === 1 ? "" : "s"}`}
              </p>
              {refreshNotice && <p className="mt-1 text-xs text-[var(--shell-text-faint)]">{refreshNotice}</p>}
            </div>
            <div className="flex items-center gap-2">
              {!isDemo && !isEmpty && (
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="app-icon-button border border-[var(--shell-border)]"
                  title="Update from live NAV data"
                  aria-label="Update portfolio from live NAV data"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                </button>
              )}
              {(!error || portfolio.funds.length > 0) && (
                <button
                  onClick={() => setShowAddFund(true)}
                  className="app-primary-button"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Fund
                </button>
              )}
            </div>
          </div>

          {error && user && !portfolio.funds.length ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-amber-400/25 bg-amber-400/10 px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400/15">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[var(--shell-text)]">Your portfolio could not be loaded</h2>
                <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--shell-text-muted)]">{error}</p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Trying again..." : "Try again"}
              </button>
            </div>
          ) : isEmpty && user ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-[var(--shell-border)] bg-[var(--shell-surface)] px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-emerald-400">
                <Plus className="h-6 w-6 text-slate-950" strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--shell-text)]">Add your first fund</h2>
                <p className="mx-auto mt-1.5 max-w-sm text-sm text-[var(--shell-text-muted)]">
                  Once you add a fund, Invesutra tracks its health, risk, and growth — and you can ask the AI about it anytime.
                </p>
              </div>
              <button
                onClick={() => setShowAddFund(true)}
                className="flex items-center gap-1.5 rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                <Plus className="h-4 w-4" />
                Add Fund
              </button>
            </div>
          ) : (
            <>
              {error && <p role="alert" className="mb-4 text-xs text-amber-700 dark:text-amber-400">{error}</p>}
              <section className="border-b border-[var(--shell-border)] pb-7">
                <ValuationStatus portfolio={portfolio} />
                <p className="text-sm text-[var(--shell-text-muted)]">Value at latest published NAV</p>
                <p className={`mt-1 font-semibold tabular-nums text-[var(--shell-text)] ${portfolio.valuationComplete === false ? "text-2xl" : "text-3xl sm:text-4xl"}`}>
                  {portfolio.valuationPending ? "Checking NAVs..." : portfolio.valuationComplete === false ? "Unavailable" : formatCurrency(portfolio.currentValue)}
                </p>
                <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                  <p className="text-[var(--shell-text-muted)]">Invested <span className="font-medium text-[var(--shell-text)]">{formatCurrency(portfolio.totalInvested, true)}</span></p>
                  {dataReady ? <p className="text-[var(--shell-text-muted)]">Change <span className={`inline-flex items-center gap-1 font-medium ${returnsUp ? "text-emerald-500" : "text-rose-500"}`}>
                    {returnsUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {formatCurrency(portfolio.returns, true)} ({formatPercent(portfolio.returnsPercent)})
                  </span></p> : <p className="text-[var(--shell-text-muted)]">Change: awaiting verified purchase and NAV data</p>}
                </div>
              </section>

              {dataReady && <section className="border-b border-[var(--shell-border)] py-6">
                <p className="text-xs font-semibold text-[var(--shell-text-faint)]">Worth a look</p>
                <p className="mt-2 max-w-2xl text-base leading-relaxed text-[var(--shell-text)]">{attentionText}</p>
                <Link
                  href={`/dashboard?q=${encodeURIComponent(attentionQuestion)}`}
                  className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-600 hover:underline"
                >
                  <MessageSquare className="h-4 w-4" /> Ask AI about this
                </Link>
              </section>}

              <section className="py-8">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-[var(--shell-text)]">Your holdings</h2>
                  <span className="text-xs text-[var(--shell-text-faint)]">{portfolio.funds.length} total</span>
                </div>
                <HoldingsTable funds={portfolio.funds} totalValue={portfolio.currentValue} onChanged={!isDemo && user ? refresh : undefined} onRepair={!isDemo && user ? setHoldingToRepair : undefined} canAskAI={!isDemo && Boolean(user)} />
              </section>

              {dataReady && <details className="group border-t border-[var(--shell-border)]">
                <summary className="flex cursor-pointer list-none items-center justify-between py-5 text-sm font-medium text-[var(--shell-text)]">
                  More analysis
                  <ChevronDown className="h-4 w-4 text-[var(--shell-text-muted)] transition-transform group-open:rotate-180" />
                </summary>
                <div className="space-y-8 pb-10">
                  <div className="grid gap-5 border-b border-[var(--shell-border)] pb-6 text-sm sm:grid-cols-3">
                    <p className="text-[var(--shell-text-muted)]">Model health <strong className={`mt-1 block text-lg ${getHealthColor(portfolio.healthScore)}`}>{portfolio.healthScore}/100</strong></p>
                    <p className="text-[var(--shell-text-muted)]">Diversification <strong className="mt-1 block text-lg text-[var(--shell-text)]">{analysis.diversificationScore}/100</strong></p>
                    <p className="text-[var(--shell-text-muted)]">Category-risk model <strong className="mt-1 block text-lg text-[var(--shell-text)]">{portfolio.riskScore}/100</strong></p>
                  </div>
                  {!isDemo && user && portfolio.id && (
                    <SinceLastVisit
                      portfolioId={portfolio.id}
                      currentHealth={portfolio.healthScore}
                      currentRisk={portfolio.riskScore}
                      currentValue={portfolio.currentValue}
                      currentInvested={portfolio.totalInvested}
                      diversificationScore={analysis.diversificationScore}
                    />
                  )}
                  <MilestoneTracker funds={portfolio.funds} />
                  {analysis.rebalancingSuggestions.length > 0 && (
                    <section>
                      <h3 className="mb-3 text-sm font-semibold text-[var(--shell-text)]">Allocation ideas to review</h3>
                      <div className="divide-y divide-[var(--shell-border)] border-y border-[var(--shell-border)]">
                        {analysis.rebalancingSuggestions.slice(0, 3).map((suggestion, index) => (
                          <div key={`${suggestion.fundId}-${index}`} className="py-4">
                            <p className="text-sm font-medium text-[var(--shell-text)]">{suggestion.fundName}: {suggestion.currentAllocation.toFixed(1)}% to {suggestion.targetAllocation.toFixed(1)}%</p>
                            <p className="mt-1 text-xs leading-relaxed text-[var(--shell-text-muted)]">{suggestion.reasoning}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              </details>}
            </>
          )}
        </div>

      </div>

      {(showAddFund || holdingToRepair) && (
        <AddFundModal
          portfolioId={!isDemo && portfolio.id ? portfolio.id : user ? "needs-portfolio" : null}
          holdingToRepair={holdingToRepair}
          onClose={() => { setShowAddFund(false); setHoldingToRepair(undefined); }}
          onAdded={() => {
            setShowAddFund(false);
            setHoldingToRepair(undefined);
            refresh();
          }}
        />
      )}
    </div>
  );
}
