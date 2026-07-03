"use client";

import { formatCurrency, formatPercent, getHealthColor, categoryLabel } from "@/lib/utils/format";
import type { Portfolio, PortfolioAnalysis } from "@/lib/types";
import {
  TrendingUp, TrendingDown, Shield, Zap,
  ChevronDown, ChevronUp, AlertTriangle,
} from "lucide-react";
import { useState } from "react";

interface Props {
  portfolio: Portfolio;
  analysis: PortfolioAnalysis;
}

export default function PortfolioContextPanel({ portfolio, analysis }: Props) {
  const [expandedSections, setExpandedSections] = useState({
    metrics: true,
    allocation: true,
    risks: true,
  });

  const returnsUp = portfolio.returnsPercent >= 0;

  function toggle(key: keyof typeof expandedSections) {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <aside className="flex h-full flex-col overflow-hidden border-l border-[var(--shell-border)] bg-[var(--shell-sidebar-bg)]">
      <div className="shrink-0 border-b border-[var(--shell-border)] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--shell-text-faint)]">Portfolio Context</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-[var(--shell-text)]">{portfolio.name}</p>
        <p className="text-xs text-[var(--shell-text-faint)]">{portfolio.funds.length} funds · {formatCurrency(portfolio.currentValue, true)}</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Key metrics */}
        <Section
          title="Key Metrics"
          expanded={expandedSections.metrics}
          onToggle={() => toggle("metrics")}
        >
          <div className="grid grid-cols-2 gap-2">
            <MetricCard
              label="Value"
              value={formatCurrency(portfolio.currentValue, true)}
              sub={`Inv. ${formatCurrency(portfolio.totalInvested, true)}`}
              icon={TrendingUp}
              color="text-emerald-400"
            />
            <MetricCard
              label="Returns"
              value={formatPercent(portfolio.returnsPercent)}
              sub={formatCurrency(portfolio.returns, true)}
              icon={returnsUp ? TrendingUp : TrendingDown}
              color={returnsUp ? "text-emerald-400" : "text-rose-400"}
            />
            <MetricCard
              label="Health"
              value={`${portfolio.healthScore}`}
              sub={analysis.overallHealth}
              icon={Shield}
              color={getHealthColor(portfolio.healthScore)}
            />
            <MetricCard
              label="Risk"
              value={`${portfolio.riskScore}`}
              sub={`Beta ${analysis.riskMetrics.beta}`}
              icon={Zap}
              color="text-amber-400"
            />
          </div>
        </Section>

        {/* Allocation */}
        <Section
          title="Allocation"
          expanded={expandedSections.allocation}
          onToggle={() => toggle("allocation")}
        >
          {Object.keys(analysis.allocationBreakdown.byCategory).length === 0 ? (
            <p className="text-xs text-[var(--shell-text-faint)]">Add funds to see allocation</p>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(analysis.allocationBreakdown.byCategory)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 5)
                .map(([cat, pct], i) => {
                  const colors = ["bg-cyan-400", "bg-emerald-400", "bg-violet-400", "bg-amber-400", "bg-rose-400"];
                  return (
                    <div key={cat}>
                      <div className="mb-1 flex justify-between text-[10px]">
                        <span className="text-[var(--shell-text-muted)]">{categoryLabel(cat)}</span>
                        <span className="font-medium text-[var(--shell-text-muted)]">{(pct as number).toFixed(1)}%</span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-[var(--shell-border)]">
                        <div
                          className={`h-full rounded-full ${colors[i % colors.length]}`}
                          style={{ width: `${Math.min(pct as number, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          <div className="mt-4 space-y-1.5 border-t border-[var(--shell-border)] pt-3">
            {[
              { label: "Sharpe", value: analysis.riskMetrics.sharpeRatio.toFixed(2) },
              { label: "Max DD", value: `${analysis.riskMetrics.maxDrawdown.toFixed(1)}%` },
              { label: "Std Dev", value: `${analysis.riskMetrics.standardDeviation.toFixed(1)}%` },
            ].map((m) => (
              <div key={m.label} className="flex justify-between text-[10px]">
                <span className="text-[var(--shell-text-faint)]">{m.label}</span>
                <span className="font-medium text-[var(--shell-text-muted)]">{m.value}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Risks & insights */}
        <Section
          title="AI Insights"
          expanded={expandedSections.risks}
          onToggle={() => toggle("risks")}
          badge={
            analysis.concentrationRisk.filter((r) => r.severity === "critical").length > 0
              ? `${analysis.concentrationRisk.filter((r) => r.severity === "critical").length} critical`
              : undefined
          }
        >
          {analysis.concentrationRisk.length === 0 && analysis.aiInsights.length === 0 ? (
            <p className="text-xs text-[var(--shell-text-faint)]">No alerts detected</p>
          ) : (
            <div className="space-y-2">
              {analysis.concentrationRisk.slice(0, 3).map((risk, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 rounded-lg border p-2.5 ${
                    risk.severity === "critical"
                      ? "border-rose-500/30 bg-rose-500/10"
                      : "border-amber-500/30 bg-amber-500/10"
                  }`}
                >
                  <AlertTriangle className={`mt-0.5 h-3 w-3 shrink-0 ${risk.severity === "critical" ? "text-rose-400" : "text-amber-400"}`} />
                  <div>
                    <p className="text-[10px] font-semibold text-[var(--shell-text)]">{risk.label}</p>
                    <p className="text-[10px] text-[var(--shell-text-muted)]">
                      {risk.currentPercent.toFixed(1)}% vs {risk.recommendedMax}% max
                    </p>
                  </div>
                </div>
              ))}
              {analysis.aiInsights.slice(0, 2).map((insight, i) => (
                <p key={i} className="text-[10px] leading-relaxed text-[var(--shell-text-muted)]">{insight}</p>
              ))}
            </div>
          )}
        </Section>
      </div>
    </aside>
  );
}

function Section({
  title,
  expanded,
  onToggle,
  badge,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-[var(--shell-border)]">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-[var(--shell-surface-2)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--shell-text-muted)]">{title}</span>
          {badge && (
            <span className="rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-rose-300">
              {badge}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-[var(--shell-text-faint)]" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-[var(--shell-text-faint)]" />
        )}
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
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
    <div className="rounded-lg border border-[var(--shell-border)] bg-[var(--shell-surface-2)] p-2.5">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[9px] font-medium uppercase tracking-wider text-[var(--shell-text-faint)]">{label}</p>
        <Icon className={`h-3 w-3 ${color}`} strokeWidth={1.5} />
      </div>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
      <p className="text-[9px] text-[var(--shell-text-faint)] truncate">{sub}</p>
    </div>
  );
}
