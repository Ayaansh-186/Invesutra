"use client";

import { useState, useEffect } from "react";
import { riskEngine } from "@/lib/algorithm/riskEngine";
import { createRebalanceEngine } from "@/lib/algorithm/rebalanceEngine";
import { SAMPLE_PORTFOLIO } from "@/lib/utils/mockData";
import { useActivePortfolio } from "@/lib/hooks/useActivePortfolio";
import { formatCurrency, formatPercent, categoryLabel, getRiskBg, getHealthColor } from "@/lib/utils/format";
import type { Fund, FundCategory, RiskLevel } from "@/lib/types";
import { Brain, Plus, Trash2, Sparkles, AlertTriangle, CheckCircle, TrendingUp, Loader2 } from "lucide-react";

const CATEGORIES: FundCategory[] = ["large_cap","mid_cap","small_cap","multi_cap","flexi_cap","debt","hybrid","index","sectoral","elss","international"];
const RISK_LEVELS: RiskLevel[] = ["low","moderate","moderately_high","high","very_high"];

const emptyFund: Omit<Fund, "id"> = {
  name: "",
  category: "large_cap",
  investedAmount: 50000,
  currentValue: 55000,
  nav: 100,
  units: 550,
  returns1Y: 10,
  returns3Y: 12,
  returns5Y: 14,
  riskLevel: "moderately_high",
  expenseRatio: 0.5,
  aum: 10000,
  benchmark: "Nifty 100",
  manager: "",
};

export default function ScreenerPage() {
  const { portfolio: activePortfolio, loading: portfolioLoading, isDemo } = useActivePortfolio();
  const [funds, setFunds] = useState<Fund[]>(SAMPLE_PORTFOLIO.funds);
  const [seeded, setSeeded] = useState(false);
  const [analysis, setAnalysis] = useState<ReturnType<typeof riskEngine.analyzePortfolio> | null>(null);
  const [rebalanceSuggestions, setRebalanceSuggestions] = useState<ReturnType<typeof createRebalanceEngine>["generateRebalancingSuggestions"] extends (...args: any[]) => infer R ? R : never>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFund, setNewFund] = useState<Omit<Fund, "id">>(emptyFund);

  // Seed the local working copy from the user's real portfolio once it's
  // loaded. This only runs once per portfolio load so edits made in the
  // screener sandbox aren't clobbered by a background refresh.
  useEffect(() => {
    if (!portfolioLoading && !seeded) {
      setFunds(activePortfolio.funds.length > 0 ? activePortfolio.funds : SAMPLE_PORTFOLIO.funds);
      setSeeded(true);
    }
  }, [portfolioLoading, seeded, activePortfolio]);

  const totalInvested = funds.reduce((s, f) => s + f.investedAmount, 0);
  const totalValue = funds.reduce((s, f) => s + f.currentValue, 0);

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState<"groq" | "gemini" | "openai" | "deterministic" | null>(null);


  function handleAnalyze() {
    setAnalyzing(true);

    const portfolio = {
      ...SAMPLE_PORTFOLIO,
      funds,
      totalInvested,
      currentValue: totalValue,
      returns: totalValue - totalInvested,
      returnsPercent: ((totalValue - totalInvested) / totalInvested) * 100,
    };

    fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portfolio }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("AI analysis request failed");
        return res.json();
      })
      .then((result) => {
        // The API route already ran the deterministic risk + rebalance
        // engines server-side; mirror that into local state so the UI
        // (which reads `analysis` / `rebalanceSuggestions`) stays in sync,
        // while layering in the AI-written narrative when available.
        const localAnalysis = riskEngine.analyzePortfolio(portfolio);
        setAnalysis({
          ...localAnalysis,
          diversificationScore: result.diversificationScore ?? localAnalysis.diversificationScore,
          concentrationRisk: result.concentrationRisk ?? localAnalysis.concentrationRisk,
          riskMetrics: result.riskMetrics ?? localAnalysis.riskMetrics,
          aiInsights: result.narrativeInsights?.length
            ? result.narrativeInsights.map((i: any) => i.body)
            : localAnalysis.aiInsights,
        });
        setRebalanceSuggestions(result.rebalancingSuggestions ?? []);
        setAiSummary(result.summary ?? null);
        setAiSource(result.source ?? "deterministic");
      })
      .catch(() => {
        // Network/API failure — fall back to the deterministic engine so
        // the screener remains fully usable offline / without API keys.
        const result = riskEngine.analyzePortfolio(portfolio);
        const eng = createRebalanceEngine();
        const suggestions = eng.generateRebalancingSuggestions(funds, totalValue);
        setAnalysis(result);
        setRebalanceSuggestions(suggestions);
        setAiSummary(null);
        setAiSource("deterministic");
      })
      .finally(() => setAnalyzing(false));
  }

  function handleAddFund() {
    const fund: Fund = { ...newFund, id: `f${Date.now()}` };
    setFunds([...funds, fund]);
    setNewFund(emptyFund);
    setShowAddForm(false);
  }

  function handleRemoveFund(id: string) {
    setFunds(funds.filter(f => f.id !== id));
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">AI Portfolio Screener</h1>
          <p className="text-sm text-slate-500">
            {portfolioLoading
              ? "Loading your portfolio..."
              : isDemo
              ? "Editing a sample portfolio — sign up to screen your own funds"
              : "Editing a working copy of your portfolio — changes here don't save automatically"}
          </p>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={analyzing || funds.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 text-white text-sm font-semibold rounded-xl hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {analyzing ? "Analyzing..." : "Run AI Analysis"}
        </button>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Fund list */}
        <div className="lg:col-span-3 space-y-4">
          {/* Summary bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex gap-6">
              <div>
                <p className="text-xs text-slate-500">Total Invested</p>
                <p className="font-semibold text-slate-900">{formatCurrency(totalInvested, true)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Current Value</p>
                <p className="font-semibold text-slate-900">{formatCurrency(totalValue, true)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Returns</p>
                <p className={`font-semibold ${totalValue >= totalInvested ? "text-emerald-600" : "text-red-500"}`}>
                  {formatPercent(((totalValue - totalInvested) / totalInvested) * 100)}
                </p>
              </div>
            </div>
            <span className="text-xs text-slate-500">{funds.length} funds</span>
          </div>

          {/* Fund rows */}
          {funds.map((fund) => (
            <div key={fund.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900 text-sm truncate">{fund.name || "Unnamed Fund"}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs border ${getRiskBg(fund.riskLevel)}`}>
                    {fund.riskLevel.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{categoryLabel(fund.category)} · ER: {fund.expenseRatio}%</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-slate-900">{formatCurrency(fund.currentValue, true)}</p>
                <p className={`text-xs font-medium ${fund.returns1Y >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {formatPercent(fund.returns1Y)} (1Y)
                </p>
              </div>
              <button onClick={() => handleRemoveFund(fund.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {/* Add fund form */}
          {showAddForm ? (
            <div className="bg-white border border-sky-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Add Fund</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-slate-500 mb-1 block">Fund Name</label>
                  <input
                    type="text"
                    value={newFund.name}
                    onChange={e => setNewFund({...newFund, name: e.target.value})}
                    placeholder="e.g. Mirae Asset Large Cap Fund"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-sky-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Category</label>
                  <select
                    value={newFund.category}
                    onChange={e => setNewFund({...newFund, category: e.target.value as FundCategory})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-sky-400"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Risk Level</label>
                  <select
                    value={newFund.riskLevel}
                    onChange={e => setNewFund({...newFund, riskLevel: e.target.value as RiskLevel})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-sky-400"
                  >
                    {RISK_LEVELS.map(r => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Invested (₹)</label>
                  <input
                    type="number"
                    value={newFund.investedAmount}
                    onChange={e => setNewFund({...newFund, investedAmount: +e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-sky-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Current Value (₹)</label>
                  <input
                    type="number"
                    value={newFund.currentValue}
                    onChange={e => setNewFund({...newFund, currentValue: +e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-sky-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">1Y Returns (%)</label>
                  <input
                    type="number"
                    value={newFund.returns1Y}
                    onChange={e => setNewFund({...newFund, returns1Y: +e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-sky-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Expense Ratio (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newFund.expenseRatio}
                    onChange={e => setNewFund({...newFund, expenseRatio: +e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-sky-400"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleAddFund} className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800">
                  Add Fund
                </button>
                <button onClick={() => setShowAddForm(false)} className="px-4 py-2 text-slate-600 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-sky-300 hover:text-sky-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add another fund
            </button>
          )}
        </div>

        {/* Analysis panel */}
        <div className="lg:col-span-2 space-y-4">
          {analysis ? (
            <>
              {/* Health Score */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-4 h-4 text-sky-600" />
                  <h3 className="text-sm font-semibold text-slate-900">Portfolio Health</h3>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-3xl font-bold text-slate-900">{analyzing ? "—" : Math.round((analysis.diversificationScore + 40) * 0.72)}/100</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                    analysis.overallHealth === "excellent" ? "bg-emerald-50 text-emerald-700" :
                    analysis.overallHealth === "good" ? "bg-blue-50 text-blue-700" :
                    analysis.overallHealth === "fair" ? "bg-amber-50 text-amber-700" :
                    "bg-red-50 text-red-700"
                  }`}>{analysis.overallHealth}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${
                    analysis.overallHealth === "excellent" ? "bg-emerald-500" :
                    analysis.overallHealth === "good" ? "bg-blue-500" :
                    analysis.overallHealth === "fair" ? "bg-amber-500" : "bg-red-500"
                  }`} style={{ width: `${analysis.diversificationScore}%` }} />
                </div>
                <p className="text-xs text-slate-500 mt-2">Diversification Score: {analysis.diversificationScore}/100</p>
              </div>

              {/* Rebalancing suggestions */}
              {rebalanceSuggestions.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-semibold text-slate-900">Rebalancing Actions</h3>
                  </div>
                  <div className="space-y-3">
                    {rebalanceSuggestions.map((s, i) => (
                      <div key={i} className={`p-3 rounded-lg border text-xs ${
                        s.action === "exit" ? "bg-red-50 border-red-200" :
                        s.action === "decrease" || s.action === "reduce" ? "bg-amber-50 border-amber-200" :
                        "bg-emerald-50 border-emerald-200"
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          {s.action === "exit" ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                          )}
                          <span className="font-semibold text-slate-800 capitalize">{s.action}: {s.fundName}</span>
                        </div>
                        <p className="text-slate-600 leading-relaxed">{s.reasoning}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Insights */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-900">AI Insights</h3>
                  {aiSource && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        aiSource && aiSource !== "deterministic"
                          ? "bg-violet-50 text-violet-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {aiSource && aiSource !== "deterministic" ? "AI-generated" : "Algorithmic"}
                    </span>
                  )}
                </div>
                {aiSummary && (
                  <p className="text-xs text-slate-700 leading-relaxed bg-sky-50 border border-sky-100 rounded-lg p-3 mb-3">
                    {aiSummary}
                  </p>
                )}
                <div className="space-y-2">
                  {analysis.aiInsights.map((insight, i) => (
                    <p key={i} className="text-xs text-slate-600 leading-relaxed py-2 border-b border-slate-100 last:border-0">
                      {insight}
                    </p>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
              <Brain className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Add funds and run AI analysis to see portfolio insights</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
