"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useActivePortfolio } from "@/lib/hooks/useActivePortfolio";
import { generateReport } from "@/lib/algorithm/reportEngine";
import { readSavedReport } from "@/lib/utils/savedReport";
import type { DbAIReport } from "@/lib/supabase/database.types";
import { formatCurrency, categoryLabel, formatRiskMetric } from "@/lib/utils/format";
import { isPortfolioDataReady } from "@/lib/marketData/quality";
import ValuationStatus from "@/components/dashboard/ValuationStatus";
import {
  FileText,
  Download,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  Shield,
  Brain,
  RefreshCw,
  BarChart2,
  Info,
  Droplets,
  Loader2,
  MessageSquare,
  Search,
} from "lucide-react";


export default function ReportsPage() {
  const { portfolio, loading: portfolioLoading, isDemo, isEmpty, error: portfolioError, refresh } = useActivePortfolio();
  const [report, setReport] = useState<ReturnType<typeof generateReport> | null>(null);
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<"free" | "pro" | "premium">("free");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [savedReports, setSavedReports] = useState<DbAIReport[]>([]);
  const [reportError, setReportError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyRetry, setHistoryRetry] = useState(0);
  const reportScope = `${portfolio.userId}:${portfolio.id}:${isDemo}`;
  const scopeRef = useRef(reportScope);
  scopeRef.current = reportScope;
  useEffect(() => { setReport(null); setSavedReports([]); setReportError(null); setGenerating(false); }, [reportScope]);
  useEffect(() => {
    if (isDemo || !portfolio.id) return;
    const controller = new AbortController();
    setLoadingHistory(true);
    setHistoryError(null);
    fetch(`/api/reports?portfolioId=${encodeURIComponent(portfolio.id)}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load saved reports.");
        if (controller.signal.aborted) return;
        const rows: DbAIReport[] = data.reports || [];
        setSavedReports(previous => [...new Map([...previous, ...rows].map(row => [row.id, row])).values()].sort((a, b) => b.generated_at.localeCompare(a.generated_at)));
        setReport(current => current || rows.map(readSavedReport).find(Boolean) || null);
      })
      .catch(error => { if (!controller.signal.aborted) setHistoryError(error instanceof Error ? error.message : "Could not load saved reports."); })
      .finally(() => { if (!controller.signal.aborted) setLoadingHistory(false); });
    return () => controller.abort();
  }, [reportScope, portfolio.id, isDemo, historyRetry]);

  useEffect(() => {
    if (isDemo) return;
    fetch("/api/user/me")
      .then((res) => res.json())
      .then((data) => {
        if (data?.plan === "pro" || data?.plan === "premium") setPlan(data.plan);
      })
      .catch(() => {
        // Non-fatal — PDF export button just stays gated on failure.
      });
  }, [isDemo]);

  const isPremium = plan === "premium";

  async function handleGenerate() {
    if (generating || portfolioError || portfolio.funds.length === 0 || !isPortfolioDataReady(portfolio)) return;
    setGenerating(true);
    setReportError(null);
    const scope = reportScope;
    try {
      if (isDemo) { setReport(generateReport(portfolio)); return; }
      const response = await fetch("/api/reports", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolioId: portfolio.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save the report.");
      const restored = data.report ? readSavedReport(data.report) : null;
      if (!restored) throw new Error("The report response is incomplete. Reload saved reports before generating again.");
      if (scope !== scopeRef.current) return;
      setReport(restored);
      setSavedReports(rows => [data.report, ...rows.filter(row => row.id !== data.report.id)]);
    } catch (error) {
      if (scope === scopeRef.current) setReportError(error instanceof Error ? error.message : "Report generation failed.");
    } finally {
      if (scope === scopeRef.current) setGenerating(false);
    }
  }

  function handleDownload() {
    if (!report) return;
    const lines = [
      `INVESUTRA — PORTFOLIO REPORT`,
      `Report ID: ${report.id}`,
      `Generated: ${report.generatedAt}`,
      ``,
      `PORTFOLIO: ${report.portfolio}`,
      `Health Score: ${report.healthScore}/100 (${report.overallHealth})`,
      `Diversification Score: ${report.analysis.diversificationScore}/100`,
      ``,
      `SUMMARY`,
      report.summary,
      ``,
      `DETECTED ISSUES`,
      ...report.issues.map((i) => `- [${i.severity.toUpperCase()}] ${i.title}: ${i.description}`),
      ``,
      `RISK METRICS`,
      `Beta: ${formatRiskMetric(report.riskMetrics.beta)}`,
      `Sharpe Ratio: ${formatRiskMetric(report.riskMetrics.sharpeRatio)}`,
      `Std Deviation: ${formatRiskMetric(report.riskMetrics.standardDeviation, 1, "%")}`,
      `Max Drawdown: ${formatRiskMetric(report.riskMetrics.maxDrawdown, 1, "%")}`,
      `VaR (95%): ${formatRiskMetric(report.riskMetrics.valueAtRisk, 1, "%")}`,
      `Historical statistics require a validated portfolio return series and suitable benchmark. Health and category-risk scores are model assessments.`,
      ``,
      `RECOMMENDATIONS`,
      ...report.recommendations.map((r) => `- ${r}`),
      ``,
      `ALGORITHM EXPLANATION`,
      report.algorithmExplanation,
      ``,
      `DISCLAIMER: This report is generated by AI for informational purposes only.`,
      `Invesutra is not a SEBI-registered investment advisor. Past performance`,
      `does not guarantee future results. Consult a qualified financial advisor before`,
      `making investment decisions.`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.id}-invesutra-report.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDownloadPdf() {
    if (!report || !isPremium || exportingPdf) return;
    setExportingPdf(true);
    try {
      const { downloadReportPdf } = await import("@/lib/pdf/generateReportPdf");
      await downloadReportPdf({
        id: report.id,
        generatedAt: report.generatedAt,
        portfolio: report.portfolio,
        healthScore: report.healthScore,
        overallHealth: report.overallHealth,
        summary: report.summary,
        analysis: report.analysis,
        funds: report.funds,
        riskMetrics: report.riskMetrics,
        issues: report.issues,
        recommendations: report.recommendations,
        algorithmExplanation: report.algorithmExplanation,
      });
    } catch {
      // Non-fatal — the plain-text export remains available as a fallback.
    } finally {
      setExportingPdf(false);
    }
  }

  const severityConfig = {
    critical: { icon: AlertCircle, bg: "bg-rose-500/10 border-rose-500/20", text: "text-rose-500", icon_color: "text-red-500" },
    warning: { icon: AlertTriangle, bg: "bg-amber-500/10 border-amber-500/20", text: "text-amber-500", icon_color: "text-amber-500" },
    info: { icon: Info, bg: "bg-cyan-500/10 border-cyan-500/20", text: "text-cyan-500", icon_color: "text-cyan-500" },
  };

  if (portfolioLoading) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center h-96">
        <RefreshCw className="w-6 h-6 text-[var(--shell-text-faint)] animate-spin" />
      </div>
    );
  }

  if (!isDemo && (isEmpty || portfolio.funds.length === 0) && !savedReports.length && !loadingHistory && !historyError) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center text-center">
        <FileText className="h-8 w-8 text-[var(--shell-text-faint)]" />
        <h1 className="mt-4 text-xl font-semibold text-[var(--shell-text)]">
          {portfolioError ? "Portfolio unavailable" : "Add holdings before creating a report"}
        </h1>
        <p className="mt-2 text-sm text-[var(--shell-text-muted)]">
          {portfolioError || "A report needs your saved funds to produce meaningful analysis."}
        </p>
        {portfolioError ? (
          <button onClick={() => void refresh()} className="mt-5 text-sm font-medium text-emerald-600 hover:underline">Try again</button>
        ) : (
          <Link href="/portfolio" className="mt-5 text-sm font-medium text-emerald-600 hover:underline">Go to portfolio</Link>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 sm:mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-[var(--shell-text)]">Investment reports</h1>
          <p className="mt-1 text-sm text-[var(--shell-text-muted)]">
            Portfolio analysis based on verified holdings
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating || Boolean(portfolioError) || !portfolio.funds.length || !isPortfolioDataReady(portfolio)}
          className="app-primary-button"
        >
          {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating ? "Generating and saving..." : "Generate report"}
        </button>
      </div>
      <ValuationStatus portfolio={portfolio} />
      {reportError && <p role="alert" className="mb-4 rounded-md border border-rose-500/20 p-3 text-sm text-rose-600">{reportError}</p>}
      {!isDemo && <section className="mb-6 border-b border-[var(--shell-border)] pb-5" aria-label="Saved reports">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--shell-text)]">Saved reports</h2>
          <button type="button" title="Reload saved reports" aria-label="Reload saved reports" disabled={loadingHistory} onClick={() => setHistoryRetry(value => value + 1)} className="app-icon-button"><RefreshCw className={`h-4 w-4 ${loadingHistory ? "animate-spin" : ""}`} /></button>
        </div>
        {historyError && <p role="alert" className="mb-2 text-sm text-amber-600">{historyError}</p>}
        {loadingHistory && <p role="status" className="text-xs text-[var(--shell-text-muted)]">Loading saved reports...</p>}
        {!loadingHistory && !historyError && !savedReports.length && <p className="text-xs text-[var(--shell-text-muted)]">No saved reports yet.</p>}
        <div className="max-h-64 overflow-y-auto">
          {savedReports.map(row => { const restored = readSavedReport(row); return <div key={row.id} className="flex flex-wrap items-start justify-between gap-2 border-t border-[var(--shell-border)] py-3">
            <div className="min-w-0 flex-1"><p className="text-xs font-medium text-[var(--shell-text)]">{new Date(row.generated_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p><p className="mt-1 text-xs leading-relaxed text-[var(--shell-text-muted)]">{row.summary}</p>{!restored && <p className="mt-1 text-xs text-[var(--shell-text-faint)]">Older report: saved summary only.</p>}</div>
            {restored && <button type="button" onClick={() => setReport(restored)} aria-pressed={report?.id === row.id} className="app-secondary-button"><FileText className="h-3.5 w-3.5" />{report?.id === row.id ? "Viewing" : "Open"}</button>}
          </div>; })}
        </div>
      </section>}
      {isDemo && (
        <div className="mb-6 flex items-start gap-3 p-4 bg-cyan-400/10 border border-cyan-500/20 rounded-xl">
          <Info className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
          <p className="text-xs text-cyan-500 leading-relaxed">
            Reports generated here are based on a sample portfolio and won&apos;t be saved.{" "}
            <a href="/auth/signup" className="font-semibold underline">
              Create a free account
            </a>{" "}
            to generate and save reports for your own portfolio.
          </p>
        </div>
      )}


      {!report && !generating && (
        <div className="border-y border-[var(--shell-border)] px-4 py-10 text-center sm:py-16">
          <div className="w-16 h-16 bg-[var(--shell-surface-2)] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-[var(--shell-text-faint)]" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--shell-text)] mb-2">No reports yet</h2>
          <p className="text-sm text-[var(--shell-text-faint)] max-w-sm mx-auto mb-6">
            Generate an AI-powered report for your portfolio. Includes health analysis, risk
            assessment, and rebalancing recommendations based on the QuantRebalance Protocol.
          </p>
          <button
            onClick={handleGenerate}
            disabled={!isPortfolioDataReady(portfolio) || !portfolio.funds.length || Boolean(portfolioError) || generating}
            className="app-primary-button"
          >
            <Sparkles className="w-4 h-4" />
            Generate your first report
          </button>
        </div>
      )}

      {generating && (
        <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-2xl p-16 text-center">
          <div className="w-16 h-16 bg-cyan-400/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Brain className="w-8 h-8 text-cyan-500 animate-pulse" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--shell-text)] mb-2">Analyzing your portfolio...</h2>
          <p className="text-sm text-[var(--shell-text-faint)]">
            AI is processing fund performance, risk metrics, and generating insights
          </p>
          <div className="mt-6 flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      )}

      {report && (
        <div className="space-y-5">
          <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-2xl p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-cyan-500" />
                  <span className="text-xs font-semibold text-cyan-500 uppercase tracking-wide">
                    AI Portfolio Report
                  </span>
                </div>
                <h2 className="text-xl font-bold text-[var(--shell-text)]">{report.portfolio}</h2>
                <p className="text-xs text-[var(--shell-text-faint)] mt-1">
                  Report ID: {report.id} · Generated: {report.generatedAt} IST
                </p>
                {!isDemo && <p className="mt-1 text-xs text-emerald-600">Saved snapshot. Values reflect the report date, not current prices.</p>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--shell-border)] text-[var(--shell-text-muted)] text-xs font-medium rounded-lg hover:bg-[var(--shell-surface-2)] transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export .txt
                </button>
                {isPremium && (
                  <button
                    onClick={handleDownloadPdf}
                    disabled={exportingPdf}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-400 text-slate-950 text-xs font-semibold rounded-lg hover:bg-cyan-300 disabled:opacity-60 transition-colors"
                  >
                    {exportingPdf ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileText className="w-3.5 h-3.5" />
                    )}
                    {exportingPdf ? "Preparing PDF..." : "Export PDF"}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 p-4 bg-[var(--shell-surface-2)] rounded-xl sm:grid-cols-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-[var(--shell-text)]">{report.healthScore}/100</p>
                <p className="text-xs text-[var(--shell-text-faint)] mt-1">Health Score</p>
              </div>
              <div className="text-center sm:border-x sm:border-[var(--shell-border)]">
                <p
                  className={`text-2xl font-bold capitalize ${
                    report.overallHealth === "excellent"
                      ? "text-emerald-500"
                      : report.overallHealth === "good"
                      ? "text-cyan-500"
                      : report.overallHealth === "fair"
                      ? "text-amber-500"
                      : "text-rose-500"
                  }`}
                >
                  {report.overallHealth}
                </p>
                <p className="text-xs text-[var(--shell-text-faint)] mt-1">Overall Status</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-[var(--shell-text)]">{report.analysis.diversificationScore}/100</p>
                <p className="text-xs text-[var(--shell-text-faint)] mt-1">Diversification</p>
              </div>
            </div>

            <div className="mt-4 p-4 bg-cyan-400/10 border border-cyan-500/20 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-cyan-500" />
                <span className="text-xs font-semibold text-cyan-500">Executive Summary</span>
              </div>
              <p className="text-sm text-[var(--shell-text-muted)] leading-relaxed">{report.summary}</p>
            </div>
          </div>

          {report.issues.length > 0 && (
            <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-[var(--shell-text)] mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Detected Issues ({report.issues.length})
              </h3>
              <div className="space-y-3">
                {report.issues.map((issue, i) => {
                  const config = severityConfig[issue.severity as keyof typeof severityConfig] || severityConfig.info;
                  return (
                    <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border ${config.bg}`}>
                      <config.icon className={`w-4 h-4 ${config.icon_color} shrink-0 mt-0.5`} />
                      <div>
                        <p className={`text-sm font-semibold ${config.text}`}>{issue.title}</p>
                        <p className={`text-xs mt-1 leading-relaxed ${config.text} opacity-80`}>{issue.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {report.rebalanceSuggestions.length > 0 && (
            <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-[var(--shell-text)] mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-violet-600" />
                QuantRebalance Suggestions
              </h3>
              <div className="space-y-3">
                {report.rebalanceSuggestions.map((s, i) => (
                  <div
                    key={i}
                    className={`p-4 rounded-xl border text-xs ${
                      s.action === "exit"
                        ? "bg-rose-500/10 border-rose-500/20"
                        : s.action === "decrease" || s.action === "reduce"
                        ? "bg-amber-500/10 border-amber-500/20"
                        : "bg-emerald-500/10 border-emerald-500/20"
                    }`}
                  >
                    <p className="font-semibold text-[var(--shell-text)] capitalize mb-1">
                      {s.action}: {s.fundName}
                    </p>
                    <p className="text-[var(--shell-text-muted)] leading-relaxed">{s.reasoning}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.alphaDeployment && (
            <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-[var(--shell-text)] mb-1 flex items-center gap-2">
                <Droplets className="w-4 h-4 text-cyan-500" />
                Alpha Pool Deployment Plan
              </h3>
              <p className="text-xs text-[var(--shell-text-faint)] mb-1">
                {formatCurrency(report.alphaDeployment.totalAlphaPool, true)} net alpha, deployed via
                the QuantRebalance Weighted Drawback Vector.
              </p>
              {report.frictionCost > 0 && (
                <p className="text-xs text-[var(--shell-text-faint)] mb-4">
                  Gross gain {formatCurrency(report.grossAlphaPool, true)} minus{" "}
                  <span className="text-amber-500 font-medium">
                    {formatCurrency(report.frictionCost, true)} real-world friction
                  </span>{" "}
                  (exit load, STCG tax, settlement slippage) = {formatCurrency(report.netAlphaPool, true)} net.
                </p>
              )}

              {report.alphaDeployment.routedVia === "weighted_drawback_vector" ? (
                <div className="space-y-2">
                  {report.alphaDeployment.deployments.map((d) => (
                    <div
                      key={d.fundId}
                      className="flex items-center justify-between p-3 bg-cyan-400/10 border border-cyan-500/20 rounded-lg text-xs"
                    >
                      <div>
                        <p className="font-semibold text-[var(--shell-text)]">{d.fundName}</p>
                        <p className="text-[var(--shell-text-faint)] mt-0.5">
                          Down {d.drawbackPercent}% from cost basis · {(d.weight * 100).toFixed(1)}% of pool
                        </p>
                      </div>
                      <p className="font-bold text-cyan-500">{formatCurrency(d.capitalDeployed, true)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs">
                  <Droplets className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-amber-500 leading-relaxed">
                    No fund is currently trading below its cost basis, so this alpha would be swept into the Dry
                    Powder reserve ({formatCurrency(report.alphaDeployment.sweptToDryPowder, true)}) rather than
                    forced into already-elevated positions — per the QRP Dry Powder Storage Layer rule.
                  </p>
                </div>
              )}
            </div>
          )}

          {report.dryPowderPreview && (
            <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-[var(--shell-text)] mb-1 flex items-center gap-2">
                <Droplets className="w-4 h-4 text-cyan-500" />
                Dry Powder Reserve
              </h3>
              <p className="text-xs text-[var(--shell-text-faint)] mb-4">
                {formatCurrency(report.dryPowderPreview.totalAlphaPool, true)} held as a hypothetical reserve —
                shows how it would deploy against your current holdings if a fund crosses a 5% structural
                correction, versus staying parked earning a stable rate.
              </p>

              {report.dryPowderPreview.triggered ? (
                <div className="space-y-2">
                  <p className="text-xs text-[var(--shell-text-muted)] mb-2">
                    Correction triggered — this capital would deploy now:
                  </p>
                  {report.dryPowderPreview.deployments.map((d) => (
                    <div
                      key={d.fundId}
                      className="flex items-center justify-between p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-xs"
                    >
                      <div>
                        <p className="font-semibold text-[var(--shell-text)]">{d.fundName}</p>
                        <p className="text-[var(--shell-text-faint)] mt-0.5">
                          Down {d.drawbackPercent}% from cost basis — past the 5% correction threshold
                        </p>
                      </div>
                      <p className="font-bold text-cyan-500">{formatCurrency(d.capitalDeployed, true)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-start gap-3 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-xs">
                  <Droplets className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                  <p className="text-cyan-500 leading-relaxed">
                    No fund has crossed the 5% correction threshold yet, so this reserve stays parked in a
                    liquid/debt instrument rather than being deployed early — per the QRP Dry Powder Storage
                    Layer rule. It only moves once a genuine dip appears to buy.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-[var(--shell-text)] mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--shell-text-muted)]" />
              Risk Metrics
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {[
                { label: "Beta", value: formatRiskMetric(report.riskMetrics.beta), desc: "Market sensitivity" },
                { label: "Sharpe Ratio", value: formatRiskMetric(report.riskMetrics.sharpeRatio), desc: "Risk-adjusted return" },
                { label: "Std. Deviation", value: formatRiskMetric(report.riskMetrics.standardDeviation, 1, "%"), desc: "Volatility measure" },
                { label: "Max Drawdown", value: formatRiskMetric(report.riskMetrics.maxDrawdown, 1, "%"), desc: "Worst peak-to-trough" },
                { label: "VaR (95%)", value: formatRiskMetric(report.riskMetrics.valueAtRisk, 1, "%"), desc: "Value at Risk" },
              ].map((m) => (
                <div key={m.label} className="p-3 bg-[var(--shell-surface-2)] rounded-xl text-center">
                  <p className="text-sm font-semibold text-[var(--shell-text)]">{m.value}</p>
                  <p className="text-xs font-medium text-[var(--shell-text-muted)] mt-0.5">{m.label}</p>
                  <p className="text-xs text-[var(--shell-text-faint)] mt-0.5">{m.desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-[var(--shell-text-muted)]">Historical statistics require a validated portfolio return series and suitable benchmark. Health and category-risk scores are model assessments, not measured market statistics.</p>
          </div>

          <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-[var(--shell-text)] mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-[var(--shell-text-muted)]" />
              Allocation Breakdown
            </h3>
            <div className="space-y-3">
              {Object.entries(report.allocationBreakdown.byCategory)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([cat, pct]) => (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="text-xs text-[var(--shell-text-muted)] font-medium w-28 shrink-0">{categoryLabel(cat)}</span>
                    <div className="flex-1 h-2 bg-[var(--shell-surface-2)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(pct as number, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-[var(--shell-text-muted)] w-12 text-right">{(pct as number).toFixed(1)}%</span>
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-[var(--shell-text)] mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              AI Recommendations
            </h3>
            <div className="space-y-3">
              {report.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 py-2.5 border-b border-[var(--shell-border)] last:border-0">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-[var(--shell-text-muted)] leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-[var(--shell-text)] mb-3 flex items-center gap-2">
              <Brain className="w-4 h-4 text-violet-600" />
              QuantRebalance Protocol Explanation
            </h3>
            <p className="text-sm text-[var(--shell-text-muted)] leading-relaxed">{report.algorithmExplanation}</p>
          </div>

          <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-2xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--shell-text-faint)] mb-1 px-2">Act on this</p>
            <div className="grid sm:grid-cols-3 gap-2">
              <Link
                href={`/dashboard?q=${encodeURIComponent(`Explain my latest report for ${report.portfolio}. Its health score is ${report.healthScore}/100. What should I review first?`)}`}
                className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm text-[var(--shell-text)] hover:bg-[var(--shell-surface-2)] transition-colors"
              >
                <MessageSquare className="h-4 w-4 text-cyan-500 shrink-0" />
                Ask AI about this report
              </Link>
              <Link
                href="/screener"
                className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm text-[var(--shell-text)] hover:bg-[var(--shell-surface-2)] transition-colors"
              >
                <Search className="h-4 w-4 text-cyan-500 shrink-0" />
                Try the suggested changes in Screener
              </Link>
              <Link
                href="/simulator"
                className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm text-[var(--shell-text)] hover:bg-[var(--shell-surface-2)] transition-colors"
              >
                <BarChart2 className="h-4 w-4 text-cyan-500 shrink-0" />
                Simulate the projected impact
              </Link>
            </div>
          </div>

          <div className="p-4 bg-[var(--shell-surface-2)] border border-[var(--shell-border)] rounded-xl text-xs text-[var(--shell-text-faint)] leading-relaxed">
            <strong className="text-[var(--shell-text-muted)]">Disclaimer:</strong> This report is generated by AI for
            informational purposes only. Invesutra is not a SEBI-registered investment advisor.
            All insights are based on algorithmic analysis of provided portfolio data. Past performance
            does not guarantee future results. Please consult a qualified financial advisor before making
            investment decisions.
          </div>
        </div>
      )}
    </div>
  );
}
