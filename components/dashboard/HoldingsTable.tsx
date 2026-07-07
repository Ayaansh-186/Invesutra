"use client";

import { useState } from "react";
import { formatCurrency, formatPercent, categoryLabel } from "@/lib/utils/format";
import type { Fund } from "@/lib/types";
import { TrendingUp, TrendingDown, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";

export default function HoldingsTable({
  funds,
  totalValue,
  onChanged,
}: {
  funds: Fund[];
  totalValue: number;
  /** Called after a successful edit or delete so the parent can refetch the portfolio. */
  onChanged?: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ investedAmount: 0, currentValue: 0 });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

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

  function startEdit(fund: Fund) {
    setConfirmDeleteId(null);
    setRowError(null);
    setEditingId(fund.id);
    setEditValues({ investedAmount: fund.investedAmount, currentValue: fund.currentValue });
  }

  async function saveEdit(fundId: string) {
    setBusyId(fundId);
    setRowError(null);
    try {
      const res = await fetch(`/api/funds/${fundId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investedAmount: editValues.investedAmount,
          currentValue: editValues.currentValue,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update fund.");
      setEditingId(null);
      onChanged?.();
    } catch (err) {
      setRowError({ id: fundId, message: err instanceof Error ? err.message : "Update failed." });
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete(fundId: string) {
    setBusyId(fundId);
    setRowError(null);
    try {
      const res = await fetch(`/api/funds/${fundId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not remove fund.");
      setConfirmDeleteId(null);
      onChanged?.();
    } catch (err) {
      setRowError({ id: fundId, message: err instanceof Error ? err.message : "Delete failed." });
      setBusyId(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-surface)]">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--shell-border)] text-[10px] font-semibold uppercase tracking-wider text-[var(--shell-text-faint)]">
            <th className="px-4 py-3">Fund</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3 text-right">Invested</th>
            <th className="px-4 py-3 text-right">Current</th>
            <th className="px-4 py-3 text-right">1Y Return</th>
            <th className="px-4 py-3 text-right">Weight</th>
            {onChanged && <th className="px-4 py-3 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((fund) => {
            const up = fund.returns1Y >= 0;
            const weight = totalValue > 0 ? (fund.currentValue / totalValue) * 100 : 0;
            const isEditing = editingId === fund.id;
            const isBusy = busyId === fund.id;

            return (
              <tr key={fund.id} className="border-b border-[var(--shell-border)] last:border-0 hover:bg-[var(--shell-surface-2)]">
                <td className="px-4 py-3">
                  <p className="font-medium text-[var(--shell-text)]">{fund.name}</p>
                  <p className="text-xs text-[var(--shell-text-faint)]">{fund.manager}</p>
                  {rowError?.id === fund.id && (
                    <p className="mt-1 text-xs text-rose-500">{rowError.message}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full border border-[var(--shell-border)] bg-[var(--shell-surface-2)] px-2 py-0.5 text-xs text-[var(--shell-text-muted)]">
                    {categoryLabel(fund.category)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-[var(--shell-text-muted)]">
                  {isEditing ? (
                    <input
                      type="number"
                      value={editValues.investedAmount}
                      onChange={(e) => setEditValues((v) => ({ ...v, investedAmount: +e.target.value }))}
                      className="w-28 rounded-lg border border-[var(--shell-border)] bg-[var(--shell-bg)] px-2 py-1 text-right text-sm text-[var(--shell-text)] outline-none focus:border-cyan-500/40"
                    />
                  ) : (
                    formatCurrency(fund.investedAmount, true)
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium text-[var(--shell-text)]">
                  {isEditing ? (
                    <input
                      type="number"
                      value={editValues.currentValue}
                      onChange={(e) => setEditValues((v) => ({ ...v, currentValue: +e.target.value }))}
                      className="w-28 rounded-lg border border-[var(--shell-border)] bg-[var(--shell-bg)] px-2 py-1 text-right text-sm text-[var(--shell-text)] outline-none focus:border-cyan-500/40"
                    />
                  ) : (
                    formatCurrency(fund.currentValue, true)
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`inline-flex items-center gap-1 font-medium ${up ? "text-emerald-500" : "text-rose-500"}`}>
                    {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {formatPercent(fund.returns1Y)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-[var(--shell-text-muted)]">{weight.toFixed(1)}%</td>

                {onChanged && (
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => saveEdit(fund.id)}
                          disabled={isBusy}
                          className="rounded-lg p-1.5 text-emerald-500 transition hover:bg-[var(--shell-surface-2)] disabled:opacity-50"
                          title="Save"
                        >
                          {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          disabled={isBusy}
                          className="rounded-lg p-1.5 text-[var(--shell-text-faint)] transition hover:bg-[var(--shell-surface-2)]"
                          title="Cancel"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : confirmDeleteId === fund.id ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-xs text-[var(--shell-text-faint)]">Remove?</span>
                        <button
                          onClick={() => confirmDelete(fund.id)}
                          disabled={isBusy}
                          className="rounded-lg p-1.5 text-rose-500 transition hover:bg-[var(--shell-surface-2)] disabled:opacity-50"
                          title="Confirm remove"
                        >
                          {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-lg p-1.5 text-[var(--shell-text-faint)] transition hover:bg-[var(--shell-surface-2)]"
                          title="Cancel"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => startEdit(fund)}
                          className="rounded-lg p-1.5 text-[var(--shell-text-faint)] transition hover:bg-[var(--shell-surface-2)] hover:text-[var(--shell-text)]"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => { setConfirmDeleteId(fund.id); setRowError(null); }}
                          className="rounded-lg p-1.5 text-[var(--shell-text-faint)] transition hover:bg-[var(--shell-surface-2)] hover:text-rose-500"
                          title="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
