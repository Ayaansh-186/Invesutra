"use client";

import { useState } from "react";
import Link from "next/link";
import { riskEngine } from "@/lib/algorithm/riskEngine";
import { useActivePortfolio } from "@/lib/hooks/useActivePortfolio";
import { useAuth } from "@/lib/hooks/useAuth";
import { formatCurrency, formatPercent, getHealthColor } from "@/lib/utils/format";
import HoldingsTable from "@/components/dashboard/HoldingsTable";
import PortfolioContextPanel from "@/components/dashboard/PortfolioContextPanel";
import PortfolioChart from "@/components/dashboard/PortfolioChart";
import AddFundModal from "@/components/dashboard/AddFundModal";
import {
  Sparkles, Plus, RefreshCw, TrendingUp, TrendingDown, Shield, Zap, MessageSquare,
} from "lucide-react";

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

          {isEmpty && user && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
              <p className="flex-1 text-sm text-[var(--shell-text-muted)]">
                Welcome! Add your first fund to start tracking your portfolio.
              </p>
              <button
                onClick={() => setShowAddFund(true)}
                className="flex items-center gap-1 rounded-lg bg-emerald-400 px-2.5 py-1 text-xs font-semibold text-slate-950"
              >
                <Plus className="h-3 w-3" />
                Add fund
              </button>
            </div>
          )}

          {/* Metric cards */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              label="Current value"
              value={formatCurrency(portfolio.currentValue, true)}
              sub={`Invested ${formatCurrency(portfolio.totalInvested, true)}`}
              icon={TrendingUp}
              color="text-emerald-500"
            />
            <MetricCard
              label="Returns"
              value={formatPercent(portfolio.returnsPercent)}
              sub={formatCurrency(portfolio.returns, true)}
              icon={returnsUp ? TrendingUp : TrendingDown}
              color={returnsUp ? "text-emerald-500" : "text-rose-500"}
            />
            <MetricCard
              label="Health score"
              value={`${portfolio.healthScore}/100`}
              sub={analysis.overallHealth}
              icon={Shield}
              color={getHealthColor(portfolio.healthScore)}
            />
            <MetricCard
              label="Risk score"
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
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-surface)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--shell-text-faint)]">{label}</p>
        <Icon className={`h-4 w-4 ${color}`} strokeWidth={1.5} />
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="truncate text-xs text-[var(--shell-text-faint)]">{sub}</p>
    </div>
  );
}
