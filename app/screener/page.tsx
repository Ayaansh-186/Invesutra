"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { riskEngine } from "@/lib/algorithm/riskEngine";
import { createRebalanceEngine } from "@/lib/algorithm/rebalanceEngine";
import { SAMPLE_PORTFOLIO } from "@/lib/utils/mockData";
import { useActivePortfolio } from "@/lib/hooks/useActivePortfolio";
import { useCountUp } from "@/lib/hooks/useCountUp";
import { formatCurrency, formatPercent, categoryLabel, getRiskBg, getHealthColor } from "@/lib/utils/format";
import type { Fund, FundCategory, RiskLevel } from "@/lib/types";
import type { FundSearchResult } from "@/lib/marketData/types";
import { Brain, Plus, Trash2, Sparkles, AlertTriangle, CheckCircle, TrendingUp, Loader2, BarChart2, MessageSquare, ArrowRight, Search } from "lucide-react";

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
  const [nameQuery, setNameQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FundSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const searchSeq = useRef(0);

  // Debounced live search against the same real-fund lookup used in the
  // Portfolio "Add Fund" modal, so typing a name here surfaces matching
  // real schemes instead of a blank text field.
  useEffect(() => {
    if (nameQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/funds/search?q=${encodeURIComponent(nameQuery.trim())}`);
        const data = await res.json();
        if (seq !== searchSeq.current) return; // a newer search superseded this one
        setSearchResults(data.funds || []);
      } catch {
        if (seq === searchSeq.current) setSearchResults([]);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [nameQuery]);

  function selectSearchResult(result: FundSearchResult) {
    setNewFund((prev) => ({
      ...prev,
      name: result.name,
      category: result.category || prev.category,
      riskLevel: result.riskLevel || prev.riskLevel,
      nav: result.nav ?? prev.nav,
      returns1Y: result.returns1Y ?? prev.returns1Y,
      returns3Y: result.returns3Y ?? prev.returns3Y,
      returns5Y: result.returns5Y ?? prev.returns5Y,
      expenseRatio: result.expenseRatio ?? prev.expenseRatio,
      aum: result.aum ?? prev.aum,
      benchmark: result.benchmark ?? prev.benchmark,
    }));
    setNameQuery(result.name);
    setShowResults(false);
  }

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
      returnsPercent: totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0,
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
    if (!newFund.name.trim()) {
      setAddError("Fund name is required.");
      return;
    }
    if (!Number.isFinite(newFund.investedAmount) || newFund.investedAmount <= 0) {
      setAddError("Invested amount must be greater than 0.");
      return;
    }
    if (!Number.isFinite(newFund.currentValue) || newFund.currentValue < 0) {
      setAddError("Current value must be 0 or greater.");
      return;
    }
    const fund: Fund = { ...newFund, id: `f${Date.now()}` };
    setFunds([...funds, fund]);
    setNewFund(emptyFund);
    setNameQuery("");
    setSearchResults([]);
    setAddError(null);
    setShowAddForm(false);
  }

  function handleRemoveFund(id: string) {
    setFunds(funds.filter(f => f.id !== id));
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--shell-text)] mb-1">AI Portfolio Screener</h1>
          <p className="text-sm text-[var(--shell-text-faint)]">
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
          className="flex items-center gap-2 px-5 py-2.5 bg-cyan-400 text-slate-950 text-sm font-semibold rounded-xl hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {analyzing ? "Analyzing..." : "Run AI Analysis"}
        </button>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Fund list */}
        <div className="lg:col-span-3 space-y-4">
          {/* Summary bar */}
          <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-xl p-4 flex items-center justify-between">
            <div className="flex gap-6">
              <div>
                <p className="text-xs text-[var(--shell-text-faint)]">Total Invested</p>
                <p className="font-semibold text-[var(--shell-text)]">{formatCurrency(totalInvested, true)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--shell-text-faint)]">Current Value</p>
                <p className="font-semibold text-[var(--shell-text)]">{formatCurrency(totalValue, true)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--shell-text-faint)]">Returns</p>
                <p className={`font-semibold ${totalValue >= totalInvested ? "text-emerald-600" : "text-red-500"}`}>
                  {formatPercent(totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0)}
                </p>
              </div>
            </div>
            <span className="text-xs text-[var(--shell-text-faint)]">{funds.length} funds</span>
          </div>

          {/* Fund rows */}
          {funds.map((fund, fi) => (
            <div
              key={fund.id}
              style={{ animationDelay: `${Math.min(fi * 0.05, 0.4)}s` }}
              className="animate-sprout bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-xl p-4 flex items-center gap-4 transition-all hover:-translate-y-0.5 hover:border-cyan-500/30 hover:shadow-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-[var(--shell-text)] text-sm truncate">{fund.name || "Unnamed Fund"}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs border ${getRiskBg(fund.riskLevel)}`}>
                    {fund.riskLevel.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-xs text-[var(--shell-text-faint)] mt-0.5">{categoryLabel(fund.category)} · ER: {fund.expenseRatio}%</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-[var(--shell-text)]">{formatCurrency(fund.currentValue, true)}</p>
                <p className={`text-xs font-medium ${fund.returns1Y >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {formatPercent(fund.returns1Y)} (1Y)
                </p>
              </div>
              <button onClick={() => handleRemoveFund(fund.id)} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-[var(--shell-text-faint)] hover:text-rose-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {/* Add fund form */}
          {showAddForm ? (
            <div className="bg-[var(--shell-surface)] border border-cyan-500/30 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[var(--shell-text)] mb-3">Add Fund</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 relative">
                  <label className="text-xs text-[var(--shell-text-faint)] mb-1 block">Fund Name</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--shell-text-faint)]" />
                    <input
                      type="text"
                      value={nameQuery}
                      onChange={(e) => {
                        setNameQuery(e.target.value);
                        setNewFund({ ...newFund, name: e.target.value });
                        setShowResults(true);
                      }}
                      onFocus={() => setShowResults(true)}
                      onBlur={() => setTimeout(() => setShowResults(false), 150)}
                      placeholder="e.g. Mirae Asset Large Cap Fund"
                      className="w-full pl-8 pr-8 py-2 border border-[var(--shell-border)] bg-[var(--shell-surface)] rounded-lg text-sm text-[var(--shell-text)] focus:outline-none focus:border-cyan-500/40"
                    />
                    {searching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--shell-text-faint)] animate-spin" />
                    )}
                  </div>

                  {/* Keyword-matched real funds, shown live below the input */}
                  {showResults && nameQuery.trim().length >= 2 && searchResults.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-[var(--shell-border)] bg-[var(--shell-surface)] shadow-lg">
                      {searchResults.map((result, i) => (
                        <button
                          key={`${result.symbol || result.name}-${i}`}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectSearchResult(result)}
                          className="group w-full text-left p-2.5 border-b border-[var(--shell-border)] last:border-0 hover:bg-cyan-400/10 transition-colors"
                        >
                          <p className="text-sm font-medium text-[var(--shell-text)] truncate group-hover:text-cyan-600">
                            {result.name}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--shell-text-faint)]">
                            {result.category && (
                              <span className="px-1.5 py-0.5 bg-[var(--shell-surface-2)] rounded-md">
                                {categoryLabel(result.category)}
                              </span>
                            )}
                            {result.nav !== undefined && <span>NAV ₹{result.nav}</span>}
                            {result.returns1Y !== undefined && <span>1Y {formatPercent(result.returns1Y)}</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {showResults && !searching && nameQuery.trim().length >= 2 && searchResults.length === 0 && (
                    <div className="absolute z-20 mt-1 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-surface)] p-2.5 shadow-lg">
                      <p className="text-xs text-[var(--shell-text-faint)]">No matching funds found — you can still fill in the details manually below.</p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs text-[var(--shell-text-faint)] mb-1 block">Category</label>
                  <select
                    value={newFund.category}
                    onChange={e => setNewFund({...newFund, category: e.target.value as FundCategory})}
                    className="w-full px-3 py-2 border border-[var(--shell-border)] bg-[var(--shell-surface)] rounded-lg text-sm text-[var(--shell-text)] focus:outline-none focus:border-cyan-500/40"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--shell-text-faint)] mb-1 block">Risk Level</label>
                  <select
                    value={newFund.riskLevel}
                    onChange={e => setNewFund({...newFund, riskLevel: e.target.value as RiskLevel})}
                    className="w-full px-3 py-2 border border-[var(--shell-border)] bg-[var(--shell-surface)] rounded-lg text-sm text-[var(--shell-text)] focus:outline-none focus:border-cyan-500/40"
                  >
                    {RISK_LEVELS.map(r => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--shell-text-faint)] mb-1 block">Invested (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={newFund.investedAmount}
                    onChange={e => setNewFund({...newFund, investedAmount: +e.target.value})}
                    className="w-full px-3 py-2 border border-[var(--shell-border)] bg-[var(--shell-surface)] rounded-lg text-sm text-[var(--shell-text)] focus:outline-none focus:border-cyan-500/40"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--shell-text-faint)] mb-1 block">Current Value (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={newFund.currentValue}
                    onChange={e => setNewFund({...newFund, currentValue: +e.target.value})}
                    className="w-full px-3 py-2 border border-[var(--shell-border)] bg-[var(--shell-surface)] rounded-lg text-sm text-[var(--shell-text)] focus:outline-none focus:border-cyan-500/40"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--shell-text-faint)] mb-1 block">1Y Returns (%)</label>
                  <input
                    type="number"
                    value={newFund.returns1Y}
                    onChange={e => setNewFund({...newFund, returns1Y: +e.target.value})}
                    className="w-full px-3 py-2 border border-[var(--shell-border)] bg-[var(--shell-surface)] rounded-lg text-sm text-[var(--shell-text)] focus:outline-none focus:border-cyan-500/40"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--shell-text-faint)] mb-1 block">Expense Ratio (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newFund.expenseRatio}
                    onChange={e => setNewFund({...newFund, expenseRatio: +e.target.value})}
                    className="w-full px-3 py-2 border border-[var(--shell-border)] bg-[var(--shell-surface)] rounded-lg text-sm text-[var(--shell-text)] focus:outline-none focus:border-cyan-500/40"
                  />
                </div>
              </div>
              {addError && (
                <p className="text-xs text-rose-500 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {addError}
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={handleAddFund} className="px-4 py-2 bg-cyan-400 text-slate-950 text-sm font-medium rounded-lg hover:bg-cyan-300">
                  Add Fund
                </button>
                <button
                  onClick={() => { setShowAddForm(false); setAddError(null); setNameQuery(""); setSearchResults([]); }}
                  className="px-4 py-2 text-[var(--shell-text-muted)] text-sm border border-[var(--shell-border)] rounded-lg hover:bg-[var(--shell-surface-2)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-[var(--shell-border)] rounded-xl text-sm text-[var(--shell-text-faint)] hover:border-cyan-500/40 hover:text-cyan-500 transition-colors"
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
              <div className="animate-sprout bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-4 h-4 text-cyan-500" />
                  <h3 className="text-sm font-semibold text-[var(--shell-text)]">Portfolio Health</h3>
                </div>
                <HealthScore
                  analyzing={analyzing}
                  score={Math.round((analysis.diversificationScore + 40) * 0.72)}
                  diversification={analysis.diversificationScore}
                  overallHealth={analysis.overallHealth}
                />
              </div>

              {/* Rebalancing suggestions */}
              {rebalanceSuggestions.length > 0 && (
                <div className="animate-sprout stagger-1 bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-semibold text-[var(--shell-text)]">Rebalancing Actions</h3>
                  </div>
                  <div className="space-y-3">
                    {rebalanceSuggestions.map((s, i) => (
                      <div
                        key={i}
                        style={{ animationDelay: `${Math.min(i * 0.06, 0.4)}s` }}
                        className={`animate-sprout p-3 rounded-lg border text-xs ${
                        s.action === "exit" ? "bg-rose-500/10 border-rose-500/20" :
                        s.action === "decrease" || s.action === "reduce" ? "bg-amber-500/10 border-amber-500/20" :
                        "bg-emerald-500/10 border-emerald-500/20"
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          {s.action === "exit" ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                          )}
                          <span className="font-semibold text-[var(--shell-text)] capitalize">{s.action}: {s.fundName}</span>
                        </div>
                        <p className="text-[var(--shell-text-muted)] leading-relaxed">{s.reasoning}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Insights */}
              <div className="animate-sprout stagger-2 bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[var(--shell-text)]">AI Insights</h3>
                  {aiSource && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        aiSource && aiSource !== "deterministic"
                          ? "bg-violet-500/15 text-violet-500"
                          : "bg-[var(--shell-surface-2)] text-[var(--shell-text-faint)]"
                      }`}
                    >
                      {aiSource && aiSource !== "deterministic" ? "AI-generated" : "Algorithmic"}
                    </span>
                  )}
                </div>
                {aiSummary && (
                  <p className="text-xs text-[var(--shell-text-muted)] leading-relaxed bg-cyan-400/10 border border-cyan-500/20 rounded-lg p-3 mb-3">
                    {aiSummary}
                  </p>
                )}
                <div className="space-y-2">
                  {analysis.aiInsights.map((insight, i) => (
                    <p key={i} className="text-xs text-[var(--shell-text-muted)] leading-relaxed py-2 border-b border-[var(--shell-border)] last:border-0">
                      {insight}
                    </p>
                  ))}
                </div>
              </div>

              {/* Next steps — close the loop into the other tools */}
              <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--shell-text-faint)] mb-1">Next</p>
                <Link
                  href="/simulator"
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-[var(--shell-text)] hover:bg-[var(--shell-surface-2)] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-cyan-500" />
                    Model these changes in the Simulator
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-[var(--shell-text-faint)]" />
                </Link>
                <Link
                  href="/dashboard"
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-[var(--shell-text)] hover:bg-[var(--shell-surface-2)] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-cyan-500" />
                    Ask Invesutra AI to explain this
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-[var(--shell-text-faint)]" />
                </Link>
              </div>
            </>
          ) : (
            <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-xl p-8 text-center">
              <Brain className="w-8 h-8 text-[var(--shell-text-faint)] mx-auto mb-3" />
              <p className="text-sm text-[var(--shell-text-faint)]">Add funds and run AI analysis to see portfolio insights</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Health score with a counting number and a bar that grows into place, so a
 * finished analysis feels like a result arriving rather than a static value.
 */
function HealthScore({
  analyzing,
  score,
  diversification,
  overallHealth,
}: {
  analyzing: boolean;
  score: number;
  diversification: number;
  overallHealth: string;
}) {
  const animatedScore = useCountUp(analyzing ? 0 : score, 900);
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    // Let the bar start at 0 on first paint, then grow to its real width.
    const t = setTimeout(() => setBarWidth(analyzing ? 0 : diversification), 60);
    return () => clearTimeout(t);
  }, [diversification, analyzing]);

  const barColor =
    overallHealth === "excellent" ? "bg-emerald-500" :
    overallHealth === "good" ? "bg-cyan-500" :
    overallHealth === "fair" ? "bg-amber-500" : "bg-red-500";

  const pillColor =
    overallHealth === "excellent" ? "bg-emerald-500/15 text-emerald-500" :
    overallHealth === "good" ? "bg-cyan-500/15 text-cyan-500" :
    overallHealth === "fair" ? "bg-amber-500/15 text-amber-500" :
    "bg-rose-500/15 text-rose-500";

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className="text-3xl font-bold tabular-nums text-[var(--shell-text)]">
          {analyzing ? "—" : Math.round(animatedScore)}/100
        </span>
        <span className={`animate-pop px-3 py-1 rounded-full text-xs font-semibold capitalize ${pillColor}`}>
          {overallHealth}
        </span>
      </div>
      <div className="h-2 bg-[var(--shell-surface-2)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${barWidth}%`, transition: "width 0.9s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
        />
      </div>
      <p className="text-xs text-[var(--shell-text-faint)] mt-2">
        Diversification Score: {diversification}/100
      </p>
    </>
  );
}
