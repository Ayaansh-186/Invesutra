"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { RankedFund, RankingPeriod } from "@/lib/marketData/topFunds";
import { formatPercent } from "@/lib/utils/format";

function researchPrompt(category: string): string {
  const text = category.toLowerCase();
  if (/small cap|mid cap|sectoral|thematic/.test(text)) return "Higher volatility: compare drawdowns, diversification, and your time horizon.";
  if (/index/.test(text)) return "Compare tracking error, expense ratio, and the index it follows.";
  if (/debt|liquid/.test(text)) return "Compare duration, credit quality, and tax treatment.";
  if (/hybrid|balanced/.test(text)) return "Review the equity/debt mix and how it changes over time.";
  return "Compare mandate, concentration, costs, and consistency across market cycles.";
}

export default function TopFunds() {
  const [period, setPeriod] = useState<RankingPeriod>("1Y");
  const [funds, setFunds] = useState<RankedFund[]>([]);
  const [universe, setUniverse] = useState("");
  const [checkedAt, setCheckedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/funds/top?period=${period}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Ranking unavailable.");
        return data;
      })
      .then((data) => {
        setFunds(data.funds);
        setUniverse(data.universe);
        setCheckedAt(data.checkedAt);
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setFunds([]);
        setError(reason instanceof Error ? reason.message : "Ranking unavailable.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [period, revision]);

  const key = period === "1Y" ? "returns1Y" : period === "3Y" ? "returns3Y" : "returns5Y";

  return (
    <section className="mb-8 border-b border-[var(--shell-border)] pb-8" aria-labelledby="top-funds-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="top-funds-title" className="text-lg font-semibold text-[var(--shell-text)]">Top performers in the comparison list</h2>
          <p className="mt-1 text-xs text-[var(--shell-text-muted)]">{period === "1Y" ? "1-year NAV return" : `${period} annualized NAV return (CAGR)`} · Research candidates based on past performance</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-[var(--shell-border)] p-0.5" aria-label="Return period">
            {(["1Y", "3Y", "5Y"] as const).map((value) => <button key={value} type="button" onClick={() => setPeriod(value)} aria-pressed={period === value} className={`h-9 min-w-10 rounded px-2 text-xs ${period === value ? "bg-cyan-400 text-slate-950" : "text-[var(--shell-text-muted)]"}`}>{value}</button>)}
          </div>
          <button type="button" disabled={loading} onClick={() => setRevision((value) => value + 1)} aria-label="Refresh ranking" title="Refresh ranking" className="app-icon-button"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
        </div>
      </div>
      <p className="mt-3 text-xs text-[var(--shell-text-faint)]">{universe || "Named direct-growth schemes"}{checkedAt && ` · Checked ${new Date(checkedAt).toLocaleString("en-IN")}`} · <a href="https://www.mfapi.in/docs/" target="_blank" rel="noopener noreferrer" className="underline">NAV source</a></p>
      {loading && <p role="status" className="mt-5 text-sm text-[var(--shell-text-muted)]">Checking published NAVs...</p>}
      {error && <p role="alert" className="mt-5 text-sm text-amber-600">{error}</p>}
      {!loading && !error && funds.length === 0 && <p className="mt-5 text-sm text-[var(--shell-text-muted)]">No schemes have a recent NAV and enough history for this period.</p>}
      {!loading && funds.length > 0 && <div className="mt-4 divide-y divide-[var(--shell-border)] border-y border-[var(--shell-border)]">
        {funds.map((fund, index) => <div key={fund.schemeCode} className="grid grid-cols-[1rem_minmax(0,1fr)_4rem] items-start gap-2 py-4 sm:grid-cols-[2rem_minmax(0,1fr)_5rem]">
          <span className="text-xs text-[var(--shell-text-faint)]">{index + 1}.</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--shell-text)]">{fund.name}</p>
            <p className="mt-0.5 text-xs text-[var(--shell-text-faint)]">NAV ₹{fund.nav.toFixed(4)} · {fund.navAsOf} · {fund.category}</p>
            <p className="mt-1 text-xs text-[var(--shell-text-muted)]">What to learn: {researchPrompt(fund.category)}</p>
          </div>
          <span className="whitespace-nowrap text-right text-sm font-semibold tabular-nums text-[var(--shell-text)]">{formatPercent(fund[key] ?? 0)}</span>
        </div>)}
      </div>}
      <p className="mt-3 text-xs text-[var(--shell-text-faint)]">For an investment decision, match fund category to your goal and risk capacity, verify costs and scheme documents, and do not extrapolate this return. Past performance is not a forecast. ETF prices may differ from NAV.</p>
    </section>
  );
}
