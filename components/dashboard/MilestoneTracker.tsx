"use client";

import { Sparkles, TrendingDown, PartyPopper } from "lucide-react";
import { createRebalanceEngine } from "@/lib/algorithm/rebalanceEngine";
import { formatCurrency, categoryLabel } from "@/lib/utils/format";
import type { Fund } from "@/lib/types";

interface MilestoneRow {
  fund: Fund;
  gainPercent: number;
  triggerPercent: number;
  progress: number; // 0-100, clamped
  reached: boolean;
  eligibleAlpha: number; // rupees, only meaningful if reached
  rupeesToGo: number; // rupees of further gain needed, only meaningful if !reached and gainPercent >= 0
  underwater: boolean;
}

function buildMilestoneRows(funds: Fund[]): MilestoneRow[] {
  const engine = createRebalanceEngine();
  const triggerPercent = engine.alphaTriggerPercent;

  const rows: MilestoneRow[] = funds
    .filter((f) => f.investedAmount > 0)
    .map((fund) => {
      const gainPercent = ((fund.currentValue - fund.investedAmount) / fund.investedAmount) * 100;
      const reached = gainPercent >= triggerPercent;
      const progress = Math.max(0, Math.min(100, (gainPercent / triggerPercent) * 100));
      const eligibleAlpha = reached ? Math.max(0, fund.currentValue - fund.investedAmount) : 0;
      const rupeesToGo = !reached
        ? Math.max(0, fund.investedAmount * (triggerPercent / 100) - (fund.currentValue - fund.investedAmount))
        : 0;
      return {
        fund,
        gainPercent,
        triggerPercent,
        progress,
        reached,
        eligibleAlpha,
        rupeesToGo,
        underwater: gainPercent < 0,
      };
    });

  // Reached funds first (biggest gain first), then closest-to-target,
  // underwater funds last — surfaces the most actionable items at top.
  return rows.sort((a, b) => {
    if (a.reached !== b.reached) return a.reached ? -1 : 1;
    if (a.underwater !== b.underwater) return a.underwater ? 1 : -1;
    return b.progress - a.progress;
  });
}

export default function MilestoneTracker({ funds }: { funds: Fund[] }) {
  const rows = buildMilestoneRows(funds);
  const reachedRows = rows.filter((r) => r.reached);
  const totalEligibleAlpha = reachedRows.reduce((sum, r) => sum + r.eligibleAlpha, 0);

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-surface)] p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--shell-text)]">
          <Sparkles className="h-4 w-4 text-cyan-500" />
          Milestone Tracker
        </h2>
        <span className="text-xs text-[var(--shell-text-faint)]">Next trigger: {rows[0]?.triggerPercent}% gain</span>
      </div>
      <p className="mb-4 text-xs text-[var(--shell-text-faint)]">
        {reachedRows.length > 0
          ? `${reachedRows.length} fund${reachedRows.length === 1 ? "" : "s"} crossed its milestone — ${formatCurrency(totalEligibleAlpha, true)} is ready for QRP alpha capture.`
          : "How close each fund is to its next QuantRebalance profit-booking trigger."}
      </p>

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.fund.id} className="rounded-xl border border-[var(--shell-border)] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--shell-text)]">{row.fund.name}</p>
                <p className="text-xs text-[var(--shell-text-faint)]">{categoryLabel(row.fund.category)}</p>
              </div>
              {row.reached ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
                  <PartyPopper className="h-3 w-3" />
                  Ready
                </span>
              ) : row.underwater ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-500">
                  <TrendingDown className="h-3 w-3" />
                  Down {Math.abs(row.gainPercent).toFixed(1)}%
                </span>
              ) : (
                <span className="shrink-0 text-[10px] font-semibold text-[var(--shell-text-muted)]">
                  {row.gainPercent.toFixed(1)}% / {row.triggerPercent}%
                </span>
              )}
            </div>

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--shell-surface-2)]">
              <div
                className={`h-full rounded-full transition-all ${
                  row.reached ? "bg-emerald-500" : row.underwater ? "bg-rose-500/40" : "bg-cyan-500"
                }`}
                style={{ width: `${row.reached ? 100 : row.progress}%` }}
              />
            </div>

            <p className="mt-1.5 text-[11px] text-[var(--shell-text-faint)]">
              {row.reached
                ? `${formatCurrency(row.eligibleAlpha, true)} unrealized gain eligible for capture`
                : row.underwater
                ? "Below cost basis — not yet eligible for profit booking"
                : `${formatCurrency(row.rupeesToGo, true)} more gain needed to reach ${row.triggerPercent}%`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
