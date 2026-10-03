"use client";
import { useState } from "react";
import type { DbAIReport } from "@/lib/supabase/database.types";
import { readSavedReport } from "@/lib/utils/savedReport";
import { compareSavedReports } from "@/lib/utils/reportComparison";
import { formatCurrencyExact } from "@/lib/utils/format";

export default function ReportComparison({ reports }: { reports: DbAIReport[] }) {
  const usable = reports.filter(row=>readSavedReport(row));
  const [first,setFirst] = useState("");
  const [second,setSecond] = useState("");
  if (usable.length<2) return null;
  const a = usable.find(row=>row.id===(first||usable[1].id));
  const b = usable.find(row=>row.id===(second||usable[0].id));
  const comparison = a&&b?compareSavedReports(a,b):null;
  return <section className="mb-6 border-b border-[var(--shell-border)] pb-5" aria-label="Report comparison"><h2 className="mb-3 text-sm font-semibold">Compare saved snapshots</h2><div className="grid gap-3 sm:grid-cols-2">{([{label:'First snapshot',value:a?.id,set:setFirst},{label:'Second snapshot',value:b?.id,set:setSecond}]).map(item=><label key={item.label} className="text-xs text-[var(--shell-text-muted)]">{item.label}<select value={item.value||''} onChange={event=>item.set(event.target.value)} className="mt-1 block h-11 w-full min-w-0 rounded-md border border-[var(--shell-border)] bg-[var(--shell-surface)] px-2 text-sm text-[var(--shell-text)]">{usable.map(row=><option key={row.id} value={row.id}>{new Date(row.generated_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}</option>)}</select></label>)}</div>{comparison?<><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-[var(--shell-text-muted)]">Value change</dt><dd className="mt-1 font-medium">{formatCurrencyExact(comparison.valueChange)}</dd></div><div><dt className="text-[var(--shell-text-muted)]">Invested amount change</dt><dd className="mt-1 font-medium">{formatCurrencyExact(comparison.investedChange)}</dd></div><div><dt className="text-[var(--shell-text-muted)]">Model health</dt><dd>{comparison.before.health}/100 to {comparison.after.health}/100</dd></div><div><dt className="text-[var(--shell-text-muted)]">Diversification</dt><dd>{comparison.before.diversification}/100 to {comparison.after.diversification}/100</dd></div></dl><p className="mt-3 text-xs text-[var(--shell-text-muted)]">Changes run from the earlier snapshot to the later one. Value change includes deposits, withdrawals and holding changes; it is not an investment return. Historical snapshots are unchanged.</p></>:<p role="status" className="mt-3 text-sm text-[var(--shell-text-muted)]">Choose two different, complete snapshots from the same portfolio.</p>}</section>;
}
