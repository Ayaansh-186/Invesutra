"use client";

import { useState } from "react";
import { useActivePortfolio } from "@/lib/hooks/useActivePortfolio";
import { riskEngine } from "@/lib/algorithm/riskEngine";
import { createRebalanceEngine } from "@/lib/algorithm/rebalanceEngine";
import { allocationEngine } from "@/lib/algorithm/allocationEngine";
import { formatCurrency, formatPercent, categoryLabel } from "@/lib/utils/format";
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
      `WEALTHSCREENER AI — PORTFOLIO REPORT`,
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

  const severityConfig = {
    critical: { icon: AlertCircle, bg: "bg-red-50 border-red-200", text: "text-red-700", icon_color: "text-red-500" },
    warning: { icon: AlertTriangle, bg: "bg-amber-50 border-amber-200", text: "text-amber-700", icon_color: "text-amber-500" },
    info: { icon: Info, bg: "bg-blue-50 border-blue-200", text: "text-blue-700", icon_color: "text-blue-500" },
  };

  if (portfolioLoading) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center h-96">
        <RefreshCw className="w-6 h-6 text-slate-300 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {isDemo && (
        <div className="mb-6 flex items-start gap-3 p-4 bg-sky-50 border border-sky-200 rounded-xl">
          <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <p className="text-xs text-sky-800 leading-relaxed">
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
          <h1 className="text-2xl font-bold text-slate-900 mb-1">AI Investment Reports</h1>
          <p className="text-sm text-slate-500">
            Generate comprehensive portfolio analysis reports powered by AI
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-60 transition-colors"
        >
          {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating ? "Generating..." : "Generate Report"}
        </button>
      </div>

      {!report && !generating && (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">No reports yet</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
            Generate an AI-powered report for your portfolio. Includes health analysis, risk
            assessment, and rebalancing recommendations based on the QuantRebalance Protocol.
          </p>
          <button
            onClick={handleGenerate}
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Generate your first report
          </button>
        </div>
      )}

      {generating && (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
          <div className="w-16 h-16 bg-sky-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Brain className="w-8 h-8 text-sky-500 animate-pulse" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Analyzing your portfolio...</h2>
          <p className="text-sm text-slate-500">
            AI is processing fund performance, risk metrics, and generating insights
          </p>
          <div className="mt-6 flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-sky-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      )}

      {report && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-sky-600" />
                  <span className="text-xs font-semibold text-sky-600 uppercase tracking-wide">
                    AI Portfolio Report
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">{report.portfolio}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Report ID: {report.id} · Generated: {report.generatedAt}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Report
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-900">{report.healthScore}/100</p>
                <p className="text-xs text-slate-500 mt-1">Health Score</p>
              </div>
              <div className="text-center border-x border-slate-200">
                <p
                  className={`text-2xl font-bold capitalize ${
                    report.overallHealth === "excellent"
                      ? "text-emerald-600"
                      : report.overallHealth === "good"
                      ? "text-blue-600"
                      : report.overallHealth === "fair"
                      ? "text-amber-600"
                      : "text-red-600"
                  }`}
                >
                  {report.overallHealth}
                </p>
                <p className="text-xs text-slate-500 mt-1">Overall Status</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-900">{report.analysis.diversificationScore}/100</p>
                <p className="text-xs text-slate-500 mt-1">Diversification</p>
              </div>
            </div>

            <div className="mt-4 p-4 bg-sky-50 border border-sky-100 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-sky-600" />
                <span className="text-xs font-semibold text-sky-800">Executive Summary</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{report.summary}</p>
            </div>
          </div>

          {report.issues.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
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
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-violet-600" />
                QuantRebalance Suggestions
              </h3>
              <div className="space-y-3">
                {report.rebalanceSuggestions.map((s, i) => (
                  <div
                    key={i}
                    className={`p-4 rounded-xl border text-xs ${
                      s.action === "exit"
                        ? "bg-red-50 border-red-200"
                        : s.action === "decrease" || s.action === "reduce"
                        ? "bg-amber-50 border-amber-200"
                        : "bg-emerald-50 border-emerald-200"
                    }`}
                  >
                    <p className="font-semibold text-slate-800 capitalize mb-1">
                      {s.action}: {s.fundName}
                    </p>
                    <p className="text-slate-600 leading-relaxed">{s.reasoning}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.alphaDeployment && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
                <Droplets className="w-4 h-4 text-sky-600" />
                Alpha Pool Deployment Plan
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                {formatCurrency(report.alphaDeployment.totalAlphaPool, true)} in eligible gains, deployed via
                the QuantRebalance Weighted Drawback Vector.
              </p>

              {report.alphaDeployment.routedVia === "weighted_drawback_vector" ? (
                <div className="space-y-2">
                  {report.alphaDeployment.deployments.map((d) => (
                    <div
                      key={d.fundId}
                      className="flex items-center justify-between p-3 bg-sky-50 border border-sky-100 rounded-lg text-xs"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">{d.fundName}</p>
                        <p className="text-slate-500 mt-0.5">
                          Down {d.drawbackPercent}% from cost basis · {(d.weight * 100).toFixed(1)}% of pool
                        </p>
                      </div>
                      <p className="font-bold text-sky-700">{formatCurrency(d.capitalDeployed, true)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs">
                  <Droplets className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-amber-700 leading-relaxed">
                    No fund is currently trading below its cost basis, so this alpha would be swept into the Dry
                    Powder reserve ({formatCurrency(report.alphaDeployment.sweptToDryPowder, true)}) rather than
                    forced into already-elevated positions — per the QRP Dry Powder Storage Layer rule.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-600" />
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
                <div key={m.label} className="p-3 bg-slate-50 rounded-xl text-center">
                  <p className="text-lg font-bold text-slate-900">{m.value}</p>
                  <p className="text-xs font-medium text-slate-700 mt-0.5">{m.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-slate-600" />
              Allocation Breakdown
            </h3>
            <div className="space-y-3">
              {Object.entries(report.allocationBreakdown.byCategory)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([cat, pct]) => (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="text-xs text-slate-600 font-medium w-28 shrink-0">{categoryLabel(cat)}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(pct as number, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 w-12 text-right">{(pct as number).toFixed(1)}%</span>
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              AI Recommendations
            </h3>
            <div className="space-y-3">
              {report.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-600 leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Brain className="w-4 h-4 text-violet-600" />
              QuantRebalance Protocol Explanation
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">{report.algorithmExplanation}</p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 leading-relaxed">
            <strong className="text-slate-700">Disclaimer:</strong> This report is generated by AI for
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
