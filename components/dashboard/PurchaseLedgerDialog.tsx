"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, X } from "lucide-react";
import type { Fund } from "@/lib/types";
import { formatCurrencyExact } from "@/lib/utils/format";
import { parsePurchaseCsv, PURCHASE_CSV_HEADER } from "@/lib/utils/purchaseImport";
import { parsePurchaseCorrection, type PurchaseCorrection } from "@/lib/utils/holdingRepair";
import { isValidPurchaseDate, roundMoney, todayInIndia } from "@/lib/utils/purchase";

type RecordInput = PurchaseCorrection & { requestId: string };
export default function PurchaseLedgerDialog({ fund, onClose, onSaved }: { fund: Fund; onClose: () => void; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"entry" | "csv">("entry");
  const [date, setDate] = useState("");
  const [units, setUnits] = useState("");
  const [nav, setNav] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [retry, setRetry] = useState(0);
  const [records, setRecords] = useState<RecordInput[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);
  const fileRead = useRef(0);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    setNav(null); requestId.current = null; setChecking(false);
    if (!isValidPurchaseDate(date) || !fund.schemeCode) return;
    const controller = new AbortController(); setChecking(true);
    fetch(`/api/funds/details?schemeCode=${fund.schemeCode}&purchaseDate=${date}`, { signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok || !data.purchase?.nav) throw new Error(data.error || "No verified NAV for this allotment date."); if (!controller.signal.aborted) {setNav(data.purchase.nav);setError(null);} })
      .catch(cause => {if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not verify buying NAV.");})
      .finally(() => {if (!controller.signal.aborted) setChecking(false);});
    return () => controller.abort();
  }, [date, fund.schemeCode, retry]);
  async function loadCsv(file?: File) {
    const read = ++fileRead.current;
    setRecords([]); setError(null);
    if (!file || !fund.schemeCode) return;
    if (file.size > 100000) {setError("CSV must be smaller than 100 KB.");return;}
    try {
      const parsed = parsePurchaseCsv(await file.text(), fund.schemeCode);
      if (read !== fileRead.current) return;
      if (parsed.some(row => fund.purchases?.some(lot => lot.date === row.purchaseDate && Math.abs(lot.units-row.units)<0.00005 && Math.abs(lot.nav-row.purchaseNav)<0.001))) throw new Error("This file includes an allotment already saved in this holding. Remove saved rows before importing.");
      setRecords(parsed.map(row => ({ ...row, requestId: crypto.randomUUID() })));
    } catch (cause) {setError(cause instanceof Error ? cause.message : "Could not read this CSV.");}
  }
  async function save() {
    let purchases = records;
    if (mode === "entry") {
      const row = parsePurchaseCorrection({ schemeCode: fund.schemeCode, purchaseDate: date, purchaseNav: nav, units: Number(units) });
      if (!row) {setError("Enter a valid allotment date and positive units with up to four decimal places.");return;}
      requestId.current ||= crypto.randomUUID(); purchases = [{ ...row, requestId: requestId.current }];
    }
    if (!purchases.length || busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/funds/${fund.id}/purchase`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purchases }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not record purchases."); onSaved();
    } catch (cause) {setError(cause instanceof Error ? cause.message : "Network error. Retry the same submission to avoid duplicate payments.");}
    finally {setBusy(false);}
  }
  function template() {
    const url = URL.createObjectURL(new Blob([`${PURCHASE_CSV_HEADER}\n`], {type:"text/csv"}));
    const anchor = document.createElement("a");anchor.href=url;anchor.download="allotments-template.csv";anchor.click();URL.revokeObjectURL(url);
  }
  return <dialog ref={dialog} onCancel={event => {if (busy) event.preventDefault();else onClose();}} aria-labelledby="purchase-ledger-title" className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-lg border border-[var(--shell-border)] bg-[var(--shell-surface)] p-5 text-[var(--shell-text)] backdrop:bg-black/40">
    <div className="flex items-start justify-between gap-3"><div><h2 id="purchase-ledger-title" className="text-lg font-semibold">Record completed purchases</h2><p className="mt-1 text-sm text-[var(--shell-text-muted)]">{fund.name}</p></div><button type="button" disabled={busy} onClick={onClose} aria-label="Close purchase records" title="Close" className="app-icon-button"><X className="h-4 w-4" /></button></div>
    <div role="group" aria-label="Purchase entry mode" className="my-4 flex gap-1 border-b border-[var(--shell-border)] pb-3">{([['entry','Single purchase'],['csv','Import CSV']] as const).map(([value,label]) => <button key={value} disabled={busy} aria-pressed={mode===value} onClick={() => {setMode(value);setError(null);}} className={mode===value?'app-primary-button':'app-secondary-button'}>{label}</button>)}</div>
    {mode==='entry' ? <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Allotment date<input type="date" max={todayInIndia()} value={date} disabled={busy} onChange={event=>setDate(event.target.value)} className="mt-1 block h-11 w-full rounded-md border border-[var(--shell-border)] bg-[var(--shell-surface)] px-3" /></label><label className="text-sm">Units allotted<input type="number" min="0.0001" step="0.0001" value={units} disabled={busy} onChange={event=>{setUnits(event.target.value);requestId.current=null;}} className="mt-1 block h-11 w-full rounded-md border border-[var(--shell-border)] bg-[var(--shell-surface)] px-3" /></label><div className="text-sm sm:col-span-2">Published buying NAV: {checking?'Checking...':nav===null?'Unavailable':formatCurrencyExact(nav,4)}{nav!==null && Number(units)>0 && <p className="mt-1 text-[var(--shell-text-muted)]">Purchase cost: {formatCurrencyExact(roundMoney(nav*Number(units)))}</p>}{error && <button onClick={()=>setRetry(value=>value+1)} className="app-secondary-button mt-2">Retry NAV</button>}</div></div> : <div><div className="flex items-center justify-between gap-3"><label className="min-w-0 text-sm">Allotment CSV<input type="file" accept=".csv,text/csv" disabled={busy} onChange={event=>void loadCsv(event.target.files?.[0])} className="mt-2 block w-full max-w-full text-xs" /></label><button onClick={template} title="Download CSV template" aria-label="Download CSV template" className="app-icon-button"><Download className="h-4 w-4" /></button></div><p className="mt-3 break-words text-xs text-[var(--shell-text-muted)]">Columns: scheme_code, allotment_date (YYYY-MM-DD), units, buying_nav. Exact scheme: {fund.schemeCode}. New purchases only.</p>{records.length>0 && <div className="mt-4 max-h-56 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th className="py-2">Date</th><th>Units</th><th>NAV</th><th>Cost</th></tr></thead><tbody>{records.map(row=><tr key={row.requestId} className="border-t border-[var(--shell-border)]"><td className="py-2">{row.purchaseDate}</td><td>{row.units}</td><td>{row.purchaseNav}</td><td>{formatCurrencyExact(roundMoney(row.units*row.purchaseNav))}</td></tr>)}</tbody></table></div>}</div>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
    <p className="mt-4 text-xs text-[var(--shell-text-muted)]">Only completed allotments are recorded. Every date and NAV is verified before saving; no payment is scheduled.</p>
    <button disabled={busy||checking||(mode==='csv'?!records.length:nav===null||!units)} onClick={()=>void save()} className="app-primary-button mt-4 w-full">{busy?<><Loader2 className="h-4 w-4 animate-spin" />Verifying and saving...</>:mode==='csv'?`Confirm ${records.length} purchases`:'Record purchase'}</button>
  </dialog>;
}
