"use client";

import { useEffect, useState } from "react";
import { useActivePortfolio } from "@/lib/hooks/useActivePortfolio";
import { riskEngine } from "@/lib/algorithm/riskEngine";
import { createRebalanceEngine } from "@/lib/algorithm/rebalanceEngine";
import { allocationEngine } from "@/lib/algorithm/allocationEngine";
import { formatCurrency, formatPercent, categoryLabel } from "@/lib/utils/format";
import { downloadReportPdf } from "@/lib/pdf/generateReportPdf";
import type { Portfolio } from "@/lib/types";
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
  Lock,
  Loader2,
} from "lucide-react";

function generateReport(portfolio: Portfolio) {
  const analysis = riskEngine.analyzePortfolio(portfolio);
  const engine = createRebalanceEngine();
  const rebalanceSuggestions = engine.generateRebalancingSuggestions(
    portfolio.funds,
    portfolio.currentValue
  );

  // Sum the unrealized gains across funds currently above the +10% QRP
  // milestone — this represents the Alpha Pool that would be captured if
  // those positions were rebalanced today. Then run it through the Weighted
  // Drawback Vector to show exactly where the algorithm would deploy it.
  const MILESTONE_THRESHOLD = 10; // percent, matches the lowest default QRP milestone
  const eligibleAlpha = portfolio.funds.reduce((sum, fund) => {
    const gainPercent =
      fund.investedAmount > 0 ? ((fund.currentValue - fund.investedAmount) / fund.investedAmount) * 100 : 0;
    if (gainPercent < MILESTONE_THRESHOLD) return sum;
    return sum + (fund.currentValue - fund.investedAmount) * (engine.alphaTriggerPercent / 100);
  }, 0);
  const alphaDeployment = eligibleAlpha > 0 ? allocationEngine.deployAlphaPool(eligibleAlpha, portfolio.funds) : null;

  // Dry Powder preview — the QRP spec's other capital pool (Page 3). Unlike
  // the Alpha Pool above (which deploys against *any* fund in drawback),
  // Dry Powder is meant to sit in a liquid/debt instrument until a fund
  // crosses a deeper "structural correction point" (the spec's example:
  // an individual fund down 5%+ from cost basis), then sweep out to buy
  // that specific dip. This shows what a hypothetical reserve equal to
  // the current eligible alpha would do against today's portfolio — an
  // illustrative preview, since a real persisted reserve balance would
  // need to be tracked across actual rebalance events over time.
  const dryPowderPreview =
    eligibleAlpha > 0 ? allocationEngine.deployDryPowder(eligibleAlpha, portfolio.funds, 5) : null;

  const returns = formatPercent(portfolio.returnsPercent);
  const value = formatCurrency(portfolio.currentValue, true);

  return {
    id: `RPT-${Date.now()}`,
    generatedAt: new Date().toLocaleString("en-IN"),
    portfolio: portfolio.name,
    healthScore: portfolio.healthScore,
    overallHealth: analysis.overallHealth,
    summary: `${portfolio.name} holds ${portfolio.funds.length} funds with a total invested capital of ${formatCurrency(portfolio.totalInvested, true)}. Current portfolio value is ${value}, representing ${returns} overall returns. The portfolio scores ${portfolio.healthScore}/100 on health and ${portfolio.riskScore}/100 on risk.`,
    analysis,
    rebalanceSuggestions,
    alphaDeployment,
    dryPowderPreview,
    funds: portfolio.funds,
    riskMetrics: analysis.riskMetrics,
    allocationBreakdown: analysis.allocationBreakdown,
    issues: [
      ...analysis.concentrationRisk.map((r) => ({
        severity: r.severity,
        title: r.label,
        description: `Current exposure: ${r.currentPercent.toFixed(1)}%. Recommended maximum: ${r.recommendedMax}%.`,
      })),
      ...(analysis.underperformers.length > 0
        ? [
            {
              severity: "warning" as const,
              title: "Underperforming Funds Detected",
              description: `${analysis.underperformers.length} fund(s) are below benchmark performance. Review and consider switching to better-performing alternatives.`,
            },
          ]
        : []),
    ],
    recommendations: [
      ...analysis.aiInsights,
      "Review your portfolio allocation quarterly to ensure it aligns with your financial goals.",
      "Consider consulting a SEBI-registered investment advisor before making significant changes.",
    ],
    algorithmExplanation: `The QuantRebalance Protocol (QRP) analyzes your portfolio using a multi-layer approach: (1) Principal Layer Protection ensures original capital is never eroded by rebalancing actions; (2) Alpha Pool extraction captures gains at predefined milestones (10%, 20%, 30%); (3) Weighted Drawback Allocation deploys captured alpha into the deepest value discounts across underperforming holdings; (4) Dry Powder Reserve maintains a liquid buffer for market correction opportunities. This systematic, emotion-free methodology is designed to compound wealth across market cycles without guaranteeing specific returns.`,
  };
}

export default function ReportsPage() {
  const { portfolio, loading: portfolioLoading, isDemo } = useActivePortfolio();
  const [report, setReport] = useState<ReturnType<typeof generateReport> | null>(null);
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<"free" | "pro" | "premium">("free");
  const [exportingPdf, setExportingPdf] = useState(false);

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

  function handleGenerate() {
    setGenerating(true);
    setTimeout(() => {
      const result = generateReport(portfolio);
      setReport(result);
      setGenerating(false);

      // Best-effort: persist the report for signed-in users so it shows up
      // in their history. Silently no-ops for demo/unauthenticated users.
      if (!isDemo) {
        fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portfolioId: portfolio.id,
            healthScore: result.healthScore,
            overallHealth: result.overallHealth,
            summary: result.summary,
            issues: result.issues,
            recommendations: result.recommendations,
            riskMetrics: result.riskMetrics,
            allocationBreakdown: result.allocationBreakdown,
            algorithmExplanation: result.algorithmExplanation,
          }),
        }).catch(() => {
          // Non-fatal — report is still shown in the UI even if saving fails.
        });
      }
    }, 1600);
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
      `Beta: ${report.riskMetrics.beta}`,
      `Sharpe Ratio: ${report.riskMetrics.sharpeRatio}`,
      `Std Deviation: ${report.riskMetrics.standardDeviation}%`,
      `Max Drawdown: ${report.riskMetrics.maxDrawdown}%`,
      `VaR (95%): ${report.riskMetrics.valueAtRisk}%`,
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
    info: { icon: Info, bg: "bg-blue-500/10 border-blue-500/20", text: "text-blue-500", icon_color: "text-blue-500" },
  };

  if (portfolioLoading) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center h-96">
        <RefreshCw className="w-6 h-6 text-[var(--shell-text-faint)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
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

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--shell-text)] mb-1">AI Investment Reports</h1>
          <p className="text-sm text-[var(--shell-text-faint)]">
            Generate comprehensive portfolio analysis reports powered by AI
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-5 py-2.5 bg-cyan-400 text-slate-950 text-sm font-semibold rounded-xl hover:bg-cyan-300 disabled:opacity-60 transition-colors"
        >
          {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating ? "Generating..." : "Generate Report"}
        </button>
      </div>

      {!report && !generating && (
        <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-2xl p-16 text-center">
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
            className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-400 text-slate-950 text-sm font-semibold rounded-xl hover:bg-cyan-300 transition-colors"
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
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-cyan-500" />
                  <span className="text-xs font-semibold text-cyan-500 uppercase tracking-wide">
                    AI Portfolio Report
                  </span>
                </div>
                <h2 className="text-xl font-bold text-[var(--shell-text)]">{report.portfolio}</h2>
                <p className="text-xs text-[var(--shell-text-faint)] mt-1">
                  Report ID: {report.id} · Generated: {report.generatedAt}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--shell-border)] text-[var(--shell-text-muted)] text-xs font-medium rounded-lg hover:bg-[var(--shell-surface-2)] transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export .txt
                </button>
                {isPremium ? (
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
                ) : (
                  <a
                    href="/pricing"
                    title="PDF export for advisors is a Premium feature"
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-[var(--shell-border)] text-[var(--shell-text-faint)] text-xs font-medium rounded-lg hover:bg-[var(--shell-surface-2)] hover:text-[var(--shell-text-muted)] transition-colors"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Export PDF
                  </a>
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
                      ? "text-blue-500"
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
              <p className="text-xs text-[var(--shell-text-faint)] mb-4">
                {formatCurrency(report.alphaDeployment.totalAlphaPool, true)} in eligible gains, deployed via
                the QuantRebalance Weighted Drawback Vector.
              </p>

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
                <Droplets className="w-4 h-4 text-blue-500" />
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
                      className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs"
                    >
                      <div>
                        <p className="font-semibold text-[var(--shell-text)]">{d.fundName}</p>
                        <p className="text-[var(--shell-text-faint)] mt-0.5">
                          Down {d.drawbackPercent}% from cost basis — past the 5% correction threshold
                        </p>
                      </div>
                      <p className="font-bold text-blue-500">{formatCurrency(d.capitalDeployed, true)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs">
                  <Droplets className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-blue-500 leading-relaxed">
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
                { label: "Beta", value: report.riskMetrics.beta.toFixed(2), desc: "Market sensitivity" },
                { label: "Sharpe Ratio", value: report.riskMetrics.sharpeRatio.toFixed(2), desc: "Risk-adjusted return" },
                { label: "Std. Deviation", value: `${report.riskMetrics.standardDeviation.toFixed(1)}%`, desc: "Volatility measure" },
                { label: "Max Drawdown", value: `${report.riskMetrics.maxDrawdown.toFixed(1)}%`, desc: "Worst peak-to-trough" },
                { label: "VaR (95%)", value: `${report.riskMetrics.valueAtRisk.toFixed(1)}%`, desc: "Value at Risk" },
              ].map((m) => (
                <div key={m.label} className="p-3 bg-[var(--shell-surface-2)] rounded-xl text-center">
                  <p className="text-lg font-bold text-[var(--shell-text)]">{m.value}</p>
                  <p className="text-xs font-medium text-[var(--shell-text-muted)] mt-0.5">{m.label}</p>
                  <p className="text-xs text-[var(--shell-text-faint)] mt-0.5">{m.desc}</p>
                </div>
              ))}
            </div>
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
