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
import PortfolioContextPanel from "@/components/dashboard/PortfolioContextPanel";
import PortfolioChart from "@/components/dashboard/PortfolioChart";
import SinceLastVisit from "@/components/dashboard/SinceLastVisit";
import {
  Sparkles, Plus, RefreshCw, TrendingUp, TrendingDown, Shield, Zap, MessageSquare,
} from "lucide-react";

// Only loaded when the user actually opens "Add Fund" — keeps this ~19KB
// form out of the initial bundle for the most-visited page in the app.
const AddFundModal = dynamic(() => import("@/components/dashboard/AddFundModal"), { ssr: false });

export default function PortfolioPage() {
  const { user } = useAuth();
  const { portfolio, loading, isDemo, isEmpty, refresh } = useActivePortfolio();
  const [showAddFund, setShowAddFund] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const analysis = portfolio.analysis ?? riskEngine.analyzePortfolio(portfolio);
  const returnsUp = portfolio.returnsPercent >= 0;

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
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

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-[var(--shell-text)]">{portfolio.name}</h1>
              <p className="text-sm text-[var(--shell-text-muted)]">
                {portfolio.funds.length} fund{portfolio.funds.length === 1 ? "" : "s"} · {formatCurrency(portfolio.currentValue, true)} current value
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 rounded-lg border border-[var(--shell-border)] bg-[var(--shell-surface-2)] px-3 py-2 text-xs font-semibold text-[var(--shell-text-muted)] transition hover:text-[var(--shell-text)]"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Ask Invesutra AI
              </Link>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="rounded-lg border border-[var(--shell-border)] p-2 text-[var(--shell-text-muted)] transition hover:text-[var(--shell-text)] disabled:opacity-50"
                title="Refresh portfolio"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={() => setShowAddFund(true)}
                className="flex items-center gap-1.5 rounded-lg bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Fund
              </button>
            </div>
          </div>

          {isEmpty && user ? (
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

              {/* Metric cards */}
              <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricCard
                  label="Current value"
                  delay={0.05}
                  value={formatCurrency(portfolio.currentValue, true)}
                  sub={`Invested ${formatCurrency(portfolio.totalInvested, true)}`}
                  icon={TrendingUp}
                  color="text-emerald-500"
                />
                <MetricCard
                  label="Returns"
                  delay={0.1}
                  value={formatPercent(portfolio.returnsPercent)}
                  sub={formatCurrency(portfolio.returns, true)}
                  icon={returnsUp ? TrendingUp : TrendingDown}
                  color={returnsUp ? "text-emerald-500" : "text-rose-500"}
                />
                <MetricCard
                  label="Health score"
                  delay={0.15}
                  value={`${portfolio.healthScore}/100`}
                  sub={analysis.overallHealth}
                  icon={Shield}
                  color={getHealthColor(portfolio.healthScore)}
                />
                <MetricCard
                  label="Risk score"
                  delay={0.2}
                  value={`${portfolio.riskScore}/100`}
                  sub={`Beta ${analysis.riskMetrics.beta.toFixed(2)}`}
                  icon={Zap}
                  color="text-amber-500"
                />
              </div>

              {/* Growth chart — large, in the main content instead of the cramped rail */}
              <div className="mb-6 rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-surface)] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[var(--shell-text)]">Growth</h2>
                  <span className="text-xs text-[var(--shell-text-faint)]">Invested vs current value, last 24 months</span>
                </div>
                <PortfolioChart invested={portfolio.totalInvested} currentValue={portfolio.currentValue} height={320} />
              </div>

              {/* Holdings */}
              <h2 className="mb-3 text-sm font-semibold text-[var(--shell-text)]">Holdings</h2>
              <HoldingsTable funds={portfolio.funds} totalValue={portfolio.currentValue} onChanged={refresh} />

              {/* Milestone Tracker */}
              <div className="mt-6">
                <MilestoneTracker funds={portfolio.funds} />
              </div>

              {/* Rebalancing suggestions */}
              {analysis.rebalancingSuggestions.length > 0 && (
                <div className="mt-6">
                  <h2 className="mb-3 text-sm font-semibold text-[var(--shell-text)]">Rebalancing suggestions</h2>
                  <div className="space-y-2">
                    {analysis.rebalancingSuggestions.map((s, i) => (
                      <div key={i} className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-surface)] p-4">
                        <p className="text-sm font-medium text-[var(--shell-text)]">
                          {s.action} {s.fundName}: {s.currentAllocation.toFixed(1)}% → {s.targetAllocation.toFixed(1)}%
                        </p>
                        <p className="mt-1 text-xs text-[var(--shell-text-muted)]">{s.reasoning}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Analytics rail */}
        <div className="hidden w-72 shrink-0 lg:block xl:w-80">
          <PortfolioContextPanel portfolio={portfolio} analysis={analysis} />
        </div>
      </div>

      {showAddFund && (
        <AddFundModal
          portfolioId={!isDemo && !isEmpty ? portfolio.id : user ? "needs-portfolio" : null}
          onClose={() => setShowAddFund(false)}
          onAdded={() => {
            setShowAddFund(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  delay = 0,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  color: string;
  delay?: number;
}) {
  return (
    <div
      style={{ animationDelay: `${delay}s` }}
      className="animate-sprout rounded-xl border border-[var(--shell-border)] bg-[var(--shell-surface)] p-4 transition-transform hover:-translate-y-0.5"
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--shell-text-faint)]">{label}</p>
        <Icon className={`h-4 w-4 ${color}`} strokeWidth={1.5} />
      </div>
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="truncate text-xs text-[var(--shell-text-faint)]">{sub}</p>
    </div>
  );
}
