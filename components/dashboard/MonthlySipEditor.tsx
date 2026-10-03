"use client";

import { useState } from "react";
import { Check, Loader2, Repeat2, X } from "lucide-react";
import type { Fund } from "@/lib/types";
import { parseMonthlySipAmount } from "@/lib/utils/monthlySip";

export default function MonthlySipEditor({ fund, onSaved }: { fund: Fund; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const value = active ? parseMonthlySipAmount(Number(amount)) : undefined;
    if (value === null || (active && !value)) { setError("Enter a positive amount with at most two decimal places."); return; }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/funds/${fund.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlySipAmount: value ?? null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save the SIP plan.");
      setOpen(false);
      onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the SIP plan."); }
    finally { setBusy(false); }
  }

  if (!open) return <button type="button" title="Edit monthly SIP plan" aria-label={`Edit monthly SIP plan for ${fund.name}`} className="app-icon-button" onClick={() => {
    setAmount(fund.monthlySipAmount?.toString() ?? ""); setActive(fund.monthlySipAmount !== undefined); setError(""); setOpen(true);
  }}><Repeat2 className="h-3.5 w-3.5" /></button>;

  return <div className="flex max-w-xs flex-col gap-2 text-left">
    <label className="flex items-center gap-2 text-xs text-[var(--shell-text)]"><input type="checkbox" checked={active} disabled={busy} onChange={event => setActive(event.target.checked)} />Monthly SIP plan</label>
    {active && <label className="text-xs text-[var(--shell-text-muted)]">Amount per month (Rs)
      <input autoFocus aria-label={`Monthly SIP amount for ${fund.name}`} type="number" min="0.01" step="0.01" value={amount} disabled={busy} onChange={event => setAmount(event.target.value)} className="mt-1 h-10 w-full min-w-0 rounded-md border border-[var(--shell-border)] bg-[var(--shell-surface)] px-2 text-sm text-[var(--shell-text)]" />
    </label>}
    {!active && <p className="text-xs text-[var(--shell-text-muted)]">No active plan</p>}
    {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
    <div className="flex justify-end gap-1">
      <button type="button" disabled={busy} onClick={save} title="Save SIP plan" aria-label="Save SIP plan" className="app-icon-button text-emerald-600">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}</button>
      <button type="button" disabled={busy} onClick={() => setOpen(false)} title="Cancel" aria-label="Cancel SIP plan editing" className="app-icon-button"><X className="h-4 w-4" /></button>
    </div>
  </div>;
}
