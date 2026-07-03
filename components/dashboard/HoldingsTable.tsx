"use client";

import { formatCurrency, formatPercent, categoryLabel } from "@/lib/utils/format";
import type { Fund } from "@/lib/types";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function HoldingsTable({ funds, totalValue }: { funds: Fund[]; totalValue: number }) {
  if (funds.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-surface)] p-8 text-center">
        <p className="text-sm text-[var(--shell-text-muted)]">
          No holdings yet. Add your first mutual fund to see it here.
        </p>
      </div>
    );
  }

  const sorted = [...funds].sort((a, b) => b.currentValue - a.currentValue);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-surface)]">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--shell-border)] text-[10px] font-semibold uppercase tracking-wider text-[var(--shell-text-faint)]">
            <th className="px-4 py-3">Fund</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3 text-right">Invested</th>
            <th className="px-4 py-3 text-right">Current</th>
            <th className="px-4 py-3 text-right">1Y Return</th>
            <th className="px-4 py-3 text-right">Weight</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((fund) => {
            const up = fund.returns1Y >= 0;
            const weight = totalValue > 0 ? (fund.currentValue / totalValue) * 100 : 0;
            return (
              <tr key={fund.id} className="border-b border-[var(--shell-border)] last:border-0 hover:bg-[var(--shell-surface-2)]">
                <td className="px-4 py-3">
                  <p className="font-medium text-[var(--shell-text)]">{fund.name}</p>
                  <p className="text-xs text-[var(--shell-text-faint)]">{fund.manager}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full border border-[var(--shell-border)] bg-[var(--shell-surface-2)] px-2 py-0.5 text-xs text-[var(--shell-text-muted)]">
                    {categoryLabel(fund.category)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-[var(--shell-text-muted)]">
                  {formatCurrency(fund.investedAmount, true)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-[var(--shell-text)]">
                  {formatCurrency(fund.currentValue, true)}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`inline-flex items-center gap-1 font-medium ${up ? "text-emerald-500" : "text-rose-500"}`}>
                    {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {formatPercent(fund.returns1Y)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-[var(--shell-text-muted)]">{weight.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
