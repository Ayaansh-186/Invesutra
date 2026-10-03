"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Brain, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useActivePortfolio } from "@/lib/hooks/useActivePortfolio";
import { formatCurrency, formatPercent, categoryLabel } from "@/lib/utils/format";
import { hasVerifiedMetric, hasVerifiedValue, isPortfolioDataReady } from "@/lib/marketData/quality";
import type { AIAnalysisResult } from "@/lib/ai/analyze";
import TopFunds from "@/components/dashboard/TopFunds";
import ValuationStatus from "@/components/dashboard/ValuationStatus";
import AIConsentDialog from "@/components/shared/AIConsentDialog";

export default function ScreenerPage() {
  const { portfolio, loading, isDemo, error, refresh } = useActivePortfolio();
  const [view, setView] = useState<"portfolio" | "top">("portfolio");
  const [result, setResult] = useState<AIAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [onlineConsent, setOnlineConsent] = useState<boolean | null>(null);
  const [askConsent, setAskConsent] = useState(false);
  const ready = isPortfolioDataReady(portfolio);

  useEffect(() => { setResult(null); }, [portfolio]);
  useEffect(() => { setOnlineConsent(null); setAskConsent(false); }, [portfolio.id]);

  async function analyze(online?: boolean) {
    if (analyzing || !ready || !portfolio.funds.length || error) return;
    const consent = online ?? onlineConsent;
    if (consent === null) { setAskConsent(true); return; }
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolio, allowPrivateAI: consent }),
        signal: AbortSignal.timeout(60_000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analysis is unavailable.");
      setResult(data);
    } catch (failure) {
      setAnalysisError(failure instanceof Error ? failure.message : "Analysis is unavailable. Please retry.");
    } finally { setAnalyzing(false); }
  }

  return (
    <div className="app-page">
      <AIConsentDialog open={askConsent} onClose={() => setAskConsent(false)} onChoose={(online) => {
        setOnlineConsent(online); setAskConsent(false); void analyze(online);
      }} />
      <header className="app-page-header">
        <div><h1 className="text-2xl font-semibold text-[var(--shell-text)]">Fund screener</h1><p className="mt-1 text-sm text-[var(--shell-text-muted)]">{isDemo ? "Demo holdings" : "Your saved holdings"}</p></div>
        <Link href="/portfolio" className="app-secondary-button">Manage holdings <ArrowRight className="h-4 w-4" /></Link>
      </header>
      <div className="mb-6 flex gap-4 border-b border-[var(--shell-border)]" role="tablist" aria-label="Fund screener views">
        {([["portfolio", "My funds"], ["top", "Top performers"]] as const).map(([key, label]) => (
          <button key={key} role="tab" aria-selected={view === key} onClick={() => setView(key)} className={`border-b-2 px-1 py-3 text-sm font-medium ${view === key ? "border-emerald-500 text-[var(--shell-text)]" : "border-transparent text-[var(--shell-text-muted)]"}`}>{label}</button>
        ))}
      </div>
      {view === "top" ? <TopFunds /> : loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-[var(--shell-text-muted)]"><Loader2 className="h-4 w-4 animate-spin" />Checking published NAVs...</div>
      ) : error && !portfolio.funds.length ? (
        <div role="alert" className="py-6 text-sm text-red-500">{error}<button onClick={() => void refresh()} className="ml-3 underline">Retry</button></div>
      ) : !portfolio.funds.length ? (
        <div className="py-12 text-center"><h2 className="text-lg font-semibold text-[var(--shell-text)]">No saved holdings</h2><Link href="/portfolio" className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-600">Add a fund <ArrowRight className="h-4 w-4" /></Link></div>
      ) : (
        <>
          {error && <p role="alert" className="mb-4 text-xs text-amber-700 dark:text-amber-400">{error}</p>}
          <ValuationStatus portfolio={portfolio} />
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-[var(--shell-text-muted)]">{portfolio.funds.length} holdings | NAV value <strong className="text-[var(--shell-text)]">{portfolio.valuationComplete === false ? "Unavailable" : formatCurrency(portfolio.currentValue)}</strong></div>
            <div className="flex items-center gap-2">
              <button title="Refresh published NAVs" aria-label="Refresh published NAVs" disabled={portfolio.valuationPending} onClick={() => void refresh()} className="app-icon-button border border-[var(--shell-border)]"><RefreshCw className={`h-4 w-4 ${portfolio.valuationPending ? "animate-spin" : ""}`} /></button>
              <button onClick={() => void analyze()} disabled={analyzing || !ready} className="app-primary-button">{analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}Analyze</button>
              <button title="Change AI privacy choice" aria-label="Change AI privacy choice" onClick={() => { setOnlineConsent(null); setAskConsent(true); }} className="app-icon-button"><ShieldCheck className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="overflow-x-auto border-y border-[var(--shell-border)]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-[var(--shell-text-faint)]"><tr><th className="py-3 pr-4 font-medium">Fund</th><th className="px-3 py-3 text-right font-medium">NAV value</th><th className="px-3 py-3 text-right font-medium">1Y</th><th className="px-3 py-3 text-right font-medium">3Y CAGR</th><th className="pl-3 py-3 text-right font-medium">5Y CAGR</th></tr></thead>
              <tbody>{portfolio.funds.map((fund) => (
                <tr key={fund.id} className="border-t border-[var(--shell-border)]">
                  <td className="max-w-xs py-4 pr-4"><p className="font-medium text-[var(--shell-text)]">{fund.name}</p><p className="mt-1 text-xs text-[var(--shell-text-faint)]">{categoryLabel(fund.category)}{fund.navAsOf ? ` | NAV ${fund.navAsOf}` : ""}</p></td>
                  <td className="px-3 py-4 text-right tabular-nums text-[var(--shell-text)]">{hasVerifiedValue(fund) ? formatCurrency(fund.currentValue) : "Unavailable"}</td>
                  {(["returns1Y", "returns3Y", "returns5Y"] as const).map((key) => <td key={key} className="px-3 py-4 text-right tabular-nums text-[var(--shell-text-muted)]">{hasVerifiedMetric(fund, key) ? formatPercent(fund[key]) : "Unavailable"}</td>)}
                </tr>
              ))}</tbody>
            </table>
          </div>
          {analysisError && <p role="alert" className="mt-4 text-sm text-red-500">{analysisError}</p>}
          {result && (
            <section className="mt-8 border-t border-[var(--shell-border)] pt-6">
              <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-[var(--shell-text)]">Portfolio review</h2><span className="text-xs text-[var(--shell-text-faint)]">{result.source === "deterministic" ? "Local analysis" : `${result.source} AI`}</span></div>
              <p className="mt-3 text-sm leading-relaxed text-[var(--shell-text-muted)]">{result.summary}</p>
              <dl className="mt-5 grid gap-5 sm:grid-cols-2">{result.narrativeInsights.map((insight) => <div key={insight.title}><dt className="text-sm font-medium text-[var(--shell-text)]">{insight.title}</dt><dd className="mt-1 text-sm leading-relaxed text-[var(--shell-text-muted)]">{insight.body}</dd></div>)}</dl>
              <p className="mt-5 text-xs text-[var(--shell-text-faint)]">Risk scores are model estimates, not observed market statistics. Past NAV returns do not predict future performance.</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
