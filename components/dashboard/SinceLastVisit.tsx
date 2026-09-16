"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, History, Flame } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";
import { useCountUp } from "@/lib/hooks/useCountUp";

type Snapshot = {
  id: string;
  health_score: number;
  risk_score: number;
  diversification_score: number;
  total_value: number;
  total_invested: number;
  created_at: string;
};

function relativeDay(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const days = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
  if (days <= 0) return "earlier today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? "" : "s"} ago`;
  return then.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * Counts consecutive calendar days (ending today or yesterday) that have at
 * least one snapshot — a light "you've been keeping an eye on this" signal.
 */
function checkInStreak(snapshots: Snapshot[]): number {
  const days = new Set(snapshots.map((s) => new Date(s.created_at).toDateString()));
  let streak = 0;
  const cursor = new Date();

  // Allow the streak to still count if today hasn't been recorded yet.
  if (!days.has(cursor.toDateString())) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(cursor.toDateString())) return 0;
  }

  while (days.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function Delta({ label, current, previous, suffix = "", stagger }: {
  label: string;
  current: number;
  previous: number;
  suffix?: string;
  stagger?: string;
}) {
  const diff = Math.round((current - previous) * 10) / 10;
  const flat = Math.abs(diff) < 0.05;
  const animated = useCountUp(diff, 850);
  const Icon = flat ? Minus : diff > 0 ? TrendingUp : TrendingDown;
  const tone = flat
    ? "text-[var(--shell-text-faint)]"
    : diff > 0
      ? "text-emerald-500"
      : "text-rose-500";

  const shown = Math.round(animated * 10) / 10;

  return (
    <div className={`flex-1 min-w-[88px] animate-sprout ${stagger ?? ""}`}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--shell-text-faint)]">{label}</p>
      <div className={`mt-0.5 flex items-center gap-1 text-sm font-semibold tabular-nums ${tone}`}>
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {flat ? "no change" : `${diff > 0 ? "+" : ""}${shown}${suffix}`}
      </div>
    </div>
  );
}

export default function SinceLastVisit({
  portfolioId,
  currentHealth,
  currentRisk,
  currentValue,
  currentInvested,
  diversificationScore,
}: {
  portfolioId: string;
  currentHealth: number;
  currentRisk: number;
  currentValue: number;
  currentInvested: number;
  diversificationScore: number;
}) {
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!portfolioId) return;

    fetch(`/api/portfolios/history?portfolioId=${encodeURIComponent(portfolioId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSnapshots(Array.isArray(data.snapshots) ? data.snapshots : []);
      })
      .catch(() => {
        if (!cancelled) setSnapshots([]);
      })
      .finally(() => {
        // Record today's state (server-side throttled to 1 per 12h) so the
        // next visit has a fresh point to compare against. Fire-and-forget.
        fetch("/api/portfolios/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portfolioId,
            healthScore: currentHealth,
            riskScore: currentRisk,
            diversificationScore,
            totalValue: currentValue,
            totalInvested: currentInvested,
          }),
        }).catch(() => {});
      });

    return () => {
      cancelled = true;
    };
    // Intentionally keyed on portfolioId only — this should run once per
    // portfolio view, not on every score recalculation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioId]);

  // NOTE: every hook must run before any early return, otherwise the hook
  // count changes between the loading render and the loaded render and React
  // throws "Rendered more hooks than during the previous render".
  const previous = snapshots?.[0];
  const valueDiff = previous ? currentValue - Number(previous.total_value) : 0;
  const animatedValue = useCountUp(valueDiff, 950);

  // Nothing to compare against yet (first ever visit) — render nothing rather
  // than an empty shell.
  if (!snapshots || snapshots.length === 0 || !previous) return null;

  const streak = checkInStreak(snapshots);

  return (
    <div className="mb-6 animate-sprout rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-surface)] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-cyan-500" />
          <h2 className="text-sm font-semibold text-[var(--shell-text)]">
            Since you last checked, {relativeDay(previous.created_at)}
          </h2>
        </div>
        {streak >= 2 && (
          <span className="flex shrink-0 animate-pop items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-semibold text-amber-500">
            <Flame className="h-3 w-3" />
            {streak}-day streak
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="min-w-[120px] flex-1 animate-sprout stagger-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--shell-text-faint)]">Value</p>
          <div
            className={`mt-0.5 flex items-center gap-1 text-sm font-semibold tabular-nums ${
              Math.abs(valueDiff) < 1
                ? "text-[var(--shell-text-faint)]"
                : valueDiff > 0
                  ? "text-emerald-500"
                  : "text-rose-500"
            }`}
          >
            {Math.abs(valueDiff) < 1 ? (
              <>
                <Minus className="h-3.5 w-3.5 shrink-0" />
                no change
              </>
            ) : (
              <>
                {valueDiff > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                )}
                {valueDiff > 0 ? "+" : "−"}
                {formatCurrency(Math.abs(animatedValue), true)}
              </>
            )}
          </div>
        </div>

        <Delta label="Health" current={currentHealth} previous={Number(previous.health_score)} stagger="stagger-2" />
        <Delta label="Risk" current={currentRisk} previous={Number(previous.risk_score)} stagger="stagger-3" />
      </div>
    </div>
  );
}
