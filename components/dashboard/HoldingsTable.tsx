"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency, formatCurrencyExact, formatPercent, categoryLabel } from "@/lib/utils/format";
import type { Fund } from "@/lib/types";
import { TrendingUp, TrendingDown, Pencil, Trash2, Check, X, Loader2, MessageSquare } from "lucide-react";
import { useToast } from "@/components/shared/ToastProvider";
import { hasVerifiedValue } from "@/lib/marketData/quality";
import { isExchangeTradedFund } from "@/lib/marketData/amfi";

export default function HoldingsTable({
  funds,
  totalValue,
  onChanged,
  canAskAI = false,
}: {
  funds: Fund[];
  totalValue: number;
  /** Called after a successful edit or delete so the parent can refetch the portfolio. */
  onChanged?: () => void;
  canAskAI?: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ investedAmount: 0, currentValue: 0 });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const { showToast } = useToast();

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
    if (!Number.isFinite(editValues.investedAmount) || editValues.investedAmount <= 0) {
      setRowError({ id: fundId, message: "Invested amount must be greater than 0." });
      return;
    }
    setBusyId(fundId);
    setRowError(null);
    try {
      const res = await fetch(`/api/funds/${fundId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investedAmount: editValues.investedAmount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update fund.");
      setEditingId(null);
      onChanged?.();
      showToast("Fund updated", "success");
    } catch (err) {
      setRowError({ id: fundId, message: err instanceof Error ? err.message : "Update failed." });
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete(fundId: string) {
    const fundName = funds.find((f) => f.id === fundId)?.name;
    setBusyId(fundId);
    setRowError(null);
    try {
      const res = await fetch(`/api/funds/${fundId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not remove fund.");
      setConfirmDeleteId(null);
      onChanged?.();
      showToast(fundName ? `Removed ${fundName}` : "Fund removed", "info");
    } catch (err) {
      setRowError({ id: fundId, message: err instanceof Error ? err.message : "Delete failed." });
      setBusyId(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--shell-border)] bg-[var(--shell-surface)]">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--shell-border)] text-[10px] font-semibold uppercase tracking-wider text-[var(--shell-text-faint)]">
            <th className="px-4 py-3">Fund</th>
            <th className="hidden px-4 py-3 md:table-cell">Category</th>
            <th className="hidden px-4 py-3 text-right md:table-cell">Invested</th>
            <th className="px-3 py-3 text-right sm:px-4">NAV value</th>
            <th className="hidden px-4 py-3 text-right sm:table-cell">Your gain/loss</th>
            <th className="hidden px-4 py-3 text-right lg:table-cell">Weight</th>
            {onChanged && <th className="px-2 py-3 text-right sm:px-4"><span className="sr-only sm:not-sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((fund) => {
            const personalReturn = fund.investedAmount > 0
              ? ((fund.currentValue - fund.investedAmount) / fund.investedAmount) * 100 : null;
            const up = personalReturn !== null && personalReturn >= 0;
            const needsReview = fund.purchaseStatus === "unverified";
            const valueVerified = hasVerifiedValue(fund);
            const costVerified = fund.purchaseStatus === undefined || fund.purchaseStatus === "verified";
            const isEtf = isExchangeTradedFund(fund.name);
            const weight = totalValue > 0 ? (fund.currentValue / totalValue) * 100 : 0;
            const isEditing = editingId === fund.id;
            const isBusy = busyId === fund.id;

            return (
              <tr key={fund.id} className="border-b border-[var(--shell-border)] last:border-0 hover:bg-[var(--shell-surface-2)]">
                <td className="min-w-0 px-3 py-3 sm:px-4">
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 font-medium text-[var(--shell-text)]">{fund.name}</p>
                    {canAskAI && (
                      <Link
                        href={`/dashboard?q=${encodeURIComponent(`Explain ${fund.name} in my saved portfolio. What should I review about this holding?`)}`}
                        className="mt-0.5 shrink-0 text-[var(--shell-text-faint)] hover:text-emerald-600"
                        aria-label={`Ask AI about ${fund.name}`}
                        title={`Ask AI about ${fund.name}`}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                  <p className="text-xs text-[var(--shell-text-faint)]">
                    <span className="md:hidden">{categoryLabel(fund.category)} · Your gain/loss {personalReturn === null || !valueVerified || !costVerified || isEtf ? "Unverified" : formatPercent(personalReturn)}</span>
                    <span className="hidden md:inline">{fund.manager}</span>
                  </p>
                  {fund.purchaseDate && (
                    <p className="mt-1 text-xs text-[var(--shell-text-faint)]">
                      Bought {new Date(`${fund.purchaseDate}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}
                      {fund.purchaseNav !== undefined && ` · ${formatCurrencyExact(fund.purchaseNav, 4)} per unit`}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-[var(--shell-text-faint)]">{fund.units.toLocaleString("en-IN", { maximumFractionDigits: 4 })} units{fund.schemeCode && ` · Scheme ${fund.schemeCode}`}</p>
                  {fund.navAsOf && <p className="mt-1 text-xs text-[var(--shell-text-faint)]">NAV {formatCurrencyExact(fund.nav, 5)} · {fund.navAsOf}{fund.navSourceUrl && <> · <a href={fund.navSourceUrl} target="_blank" rel="noopener noreferrer" className="underline">Source</a></>}</p>}
                  {isEtf && <p className="mt-1 text-xs font-medium text-amber-600">ETF market price is not verified. Saved value is not a live exchange quote.</p>}
                  {needsReview && <p className="mt-1 text-xs font-medium text-amber-600">Purchase details do not match the published allotment-date NAV. Check your statement before relying on returns.</p>}
                  {!valueVerified && !isEtf && <p className="mt-1 text-xs text-amber-600">{fund.valuationStatus === "missing_units" ? "Units are missing. Add the holding again with statement units." : fund.valuationStatus === "missing_scheme" ? "Exact scheme could not be identified. Add the holding again from verified search." : "Recent NAV could not be verified. The last saved value is shown below."}</p>}
                  <p className="mt-1 text-[11px] text-[var(--shell-text-faint)] md:hidden">
                    Invested {formatCurrency(fund.investedAmount, true)}
                  </p>
                  {isEditing && (
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      aria-label={`Invested amount for ${fund.name}`}
                      value={editValues.investedAmount}
                      onChange={(e) => setEditValues((v) => ({ ...v, investedAmount: +e.target.value }))}
                      className="mt-2 w-full rounded-lg border border-[var(--shell-border)] bg-[var(--shell-bg)] px-2 py-1 text-sm text-[var(--shell-text)] outline-none focus:border-cyan-500/40 md:hidden"
                    />
                  )}
                  {rowError?.id === fund.id && (
                    <p className="mt-1 text-xs text-rose-500">{rowError.message}</p>
                  )}
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  <span className="rounded-full border border-[var(--shell-border)] bg-[var(--shell-surface-2)] px-2 py-0.5 text-xs text-[var(--shell-text-muted)]">
                    {categoryLabel(fund.category)}
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-right text-[var(--shell-text-muted)] md:table-cell">
                  {isEditing ? (
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      aria-label={`Invested amount for ${fund.name}`}
                      value={editValues.investedAmount}
                      onChange={(e) => setEditValues((v) => ({ ...v, investedAmount: +e.target.value }))}
                      className="w-28 rounded-lg border border-[var(--shell-border)] bg-[var(--shell-bg)] px-2 py-1 text-right text-sm text-[var(--shell-text)] outline-none focus:border-cyan-500/40"
                    />
                  ) : (
                    formatCurrency(fund.investedAmount, true)
                  )}
                </td>
                <td className="px-3 py-3 text-right font-medium text-[var(--shell-text)] sm:px-4">
                  {valueVerified ? formatCurrency(fund.currentValue, true) : <><span className="text-[var(--shell-text-faint)]">Unavailable</span><span className="mt-1 block text-[10px] font-normal text-[var(--shell-text-faint)]">Last saved {formatCurrency(fund.currentValue, true)}</span></>}
                </td>
                <td className="hidden px-4 py-3 text-right sm:table-cell">
                  {personalReturn === null || !valueVerified || !costVerified || isEtf ? <span className="text-[var(--shell-text-faint)]">Unverified</span> :
                    <span className={`inline-flex items-center gap-1 font-medium ${up ? "text-emerald-500" : "text-rose-500"}`}>
                      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {formatPercent(personalReturn)}
                    </span>}
                </td>
                <td className="hidden px-4 py-3 text-right text-[var(--shell-text-muted)] lg:table-cell">{valueVerified && funds.every(hasVerifiedValue) ? `${weight.toFixed(1)}%` : "Unavailable"}</td>

                {onChanged && (
                  <td className="px-2 py-3 text-right sm:px-4">
                    {isEditing ? (
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => saveEdit(fund.id)}
                          disabled={isBusy}
                          className="rounded-lg p-1.5 text-emerald-500 transition hover:bg-[var(--shell-surface-2)] disabled:opacity-50"
                          title="Save"
                          aria-label={`Save changes to ${fund.name}`}
                        >
                          {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          disabled={isBusy}
                          className="rounded-lg p-1.5 text-[var(--shell-text-faint)] transition hover:bg-[var(--shell-surface-2)]"
                          title="Cancel"
                          aria-label={`Cancel editing ${fund.name}`}
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
                          aria-label={`Confirm removing ${fund.name}`}
                        >
                          {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-lg p-1.5 text-[var(--shell-text-faint)] transition hover:bg-[var(--shell-surface-2)]"
                          title="Cancel"
                          aria-label={`Cancel removing ${fund.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1">
                        {!fund.purchaseDate && !isEtf && <button
                          onClick={() => startEdit(fund)}
                          className="rounded-lg p-1.5 text-[var(--shell-text-faint)] transition hover:bg-[var(--shell-surface-2)] hover:text-[var(--shell-text)]"
                          title="Edit invested amount"
                          aria-label={`Edit invested amount for ${fund.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>}
                        <button
                          onClick={() => { setConfirmDeleteId(fund.id); setRowError(null); }}
                          className="rounded-lg p-1.5 text-[var(--shell-text-faint)] transition hover:bg-[var(--shell-surface-2)] hover:text-rose-500"
                          title="Remove"
                          aria-label={`Remove ${fund.name}`}
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
