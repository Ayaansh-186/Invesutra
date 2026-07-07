"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X, Loader2, AlertCircle, Search, ArrowLeft, CheckCircle2 } from "lucide-react";
import { categoryLabel, formatPercent } from "@/lib/utils/format";
import type { FundCategory, RiskLevel } from "@/lib/types";
import type { FundSearchResult } from "@/lib/marketData/types";

const CATEGORIES: FundCategory[] = [
  "large_cap","mid_cap","small_cap","multi_cap","flexi_cap",
  "debt","hybrid","index","sectoral","elss","international",
];
const RISK_LEVELS: RiskLevel[] = ["low","moderate","moderately_high","high","very_high"];

interface Props {
  // null  = not signed in (show sign-up CTA)
  // "needs-portfolio" = signed in but no portfolio created yet
  // string UUID = existing portfolio to add fund to
  portfolioId: string | null;
  onClose: () => void;
  onAdded: () => void;
}

const emptyForm = {
  name: "",
  category: "large_cap" as FundCategory,
  investedAmount: 50000,
  currentValue: 55000,
  returns1Y: 10,
  riskLevel: "moderately_high" as RiskLevel,
  expenseRatio: 0.5,
  nav: 100,
  units: 550,
  returns3Y: 12,
  returns5Y: 14,
  aum: 10000,
  benchmark: "",
  manager: "",
};

export default function AddFundModal({ portfolioId, onClose, onAdded }: Props) {
  const [mode, setMode] = useState<"search" | "manual" | "selected">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FundSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [selectedFund, setSelectedFund] = useState<FundSearchResult | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced search against the MCP-backed fund data (real AMFI schemes).
  const searchSeq = useRef(0);
  useEffect(() => {
    if (mode !== "search") return;
    if (query.trim().length < 2) {
      setResults([]);
      setSearchMessage(null);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/funds/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        if (seq !== searchSeq.current) return; // a newer search superseded this one
        setResults(data.funds || []);
        setSearchMessage(data.message || null);
      } catch {
        if (seq === searchSeq.current) setSearchMessage("Search failed. You can still add this fund manually.");
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, mode]);

  function selectFund(fund: FundSearchResult) {
    setSelectedFund(fund);
    setForm((prev) => ({
      ...prev,
      name: fund.name,
      category: fund.category || prev.category,
      riskLevel: fund.riskLevel || prev.riskLevel,
      nav: fund.nav ?? prev.nav,
      returns1Y: fund.returns1Y ?? prev.returns1Y,
      returns3Y: fund.returns3Y ?? prev.returns3Y,
      returns5Y: fund.returns5Y ?? prev.returns5Y,
      expenseRatio: fund.expenseRatio ?? prev.expenseRatio,
      aum: fund.aum ?? prev.aum,
      benchmark: fund.benchmark ?? prev.benchmark,
      // Keep whatever invested amount the user already typed; if this is
      // the first pick, seed currentValue = investedAmount as a starting
      // point (still fully editable below).
      currentValue: prev.currentValue || prev.investedAmount,
      units: fund.nav ? Number((prev.investedAmount / fund.nav).toFixed(4)) : prev.units,
    }));
    setMode("selected");
  }

  function backToSearch() {
    setSelectedFund(null);
    setMode("search");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Fund name is required."); return; }
    setSubmitting(true);
    setError(null);

    try {
      let pid = portfolioId;

      // If signed in but no portfolio yet, create one first
      if (pid === "needs-portfolio") {
        const createRes = await fetch("/api/portfolios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "My Portfolio" }),
        });
        const createData = await createRes.json();
        if (!createRes.ok) { setError(createData.error || "Could not create portfolio."); setSubmitting(false); return; }
        pid = createData.portfolio?.id;
      }

      if (!pid) { setError("No portfolio found."); setSubmitting(false); return; }

      const res = await fetch(`/api/portfolios/${pid}/funds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Could not add fund."); setSubmitting(false); return; }
      onAdded();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  // Not signed in at all
  if (portfolioId === null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
        <div className="bg-[var(--shell-surface)] rounded-2xl max-w-sm w-full p-8 text-center shadow-2xl">
          <div className="w-12 h-12 bg-cyan-400/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔐</span>
          </div>
          <h2 className="text-lg font-bold text-[var(--shell-text)] mb-2">Sign in to add funds</h2>
          <p className="text-sm text-[var(--shell-text-faint)] mb-6 leading-relaxed">
            Create a free Invesutra account to build and save your own portfolio.
          </p>
          <Link
            href="/auth/signup"
            className="block w-full py-3 bg-cyan-400 text-slate-950 text-sm font-semibold rounded-xl hover:bg-cyan-300 transition-colors mb-3"
          >
            Create free account
          </Link>
          <button onClick={onClose} className="text-sm text-[var(--shell-text-faint)] hover:text-[var(--shell-text)]">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <div className="bg-[var(--shell-surface)] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-[var(--shell-border)] sticky top-0 bg-[var(--shell-surface)] rounded-t-2xl z-10">
          <div>
            <h2 className="text-base font-semibold text-[var(--shell-text)]">Add Mutual Fund</h2>
            <p className="text-xs text-[var(--shell-text-faint)] mt-0.5">
              {mode === "search" && "Search real Indian mutual fund schemes (AMFI data)"}
              {mode === "selected" && "Confirm your invested amount"}
              {mode === "manual" && "Enter your fund details manually"}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--shell-surface-2)] text-[var(--shell-text-faint)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* --- Step 1: search --- */}
        {mode === "search" && (
          <div className="p-5 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--shell-text-faint)]" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. HDFC Flexi Cap, Mirae Asset Large Cap..."
                className="w-full pl-9 pr-3 py-2.5 border border-[var(--shell-border)] rounded-xl text-sm focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/10"
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--shell-text-faint)] animate-spin" />}
            </div>

            {query.trim().length > 0 && query.trim().length < 2 && (
              <p className="text-xs text-[var(--shell-text-faint)]">Keep typing — at least 2 characters.</p>
            )}

            {results.length > 0 && (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {results.map((fund, i) => (
                  <button
                    key={`${fund.symbol || fund.name}-${i}`}
                    type="button"
                    onClick={() => selectFund(fund)}
                    className="w-full text-left p-3 border border-[var(--shell-border)] rounded-xl hover:border-sky-300 hover:bg-cyan-400/10/50 transition-colors"
                  >
                    <p className="text-sm font-medium text-[var(--shell-text)] truncate">{fund.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--shell-text-faint)]">
                      {fund.category && (
                        <span className="px-1.5 py-0.5 bg-[var(--shell-surface-2)] rounded-md">{categoryLabel(fund.category)}</span>
                      )}
                      {fund.nav !== undefined && <span>NAV ₹{fund.nav}</span>}
                      {fund.returns1Y !== undefined && <span>1Y {formatPercent(fund.returns1Y)}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!searching && query.trim().length >= 2 && results.length === 0 && (
              <p className="text-xs text-[var(--shell-text-faint)]">{searchMessage || "No matching funds found."}</p>
            )}

            <button
              type="button"
              onClick={() => { setForm(emptyForm); setMode("manual"); }}
              className="text-xs text-[var(--shell-text-faint)] hover:text-[var(--shell-text)] underline underline-offset-2"
            >
              Can't find your fund? Add it manually instead
            </button>
          </div>
        )}

        {/* --- Step 2 (from search): confirm amount --- */}
        {mode === "selected" && (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--shell-text)] truncate">{form.name}</p>
                <p className="text-xs text-[var(--shell-text-faint)] mt-0.5">
                  {categoryLabel(form.category)} · {form.riskLevel.replace(/_/g, " ")} risk
                  {form.nav ? ` · NAV ₹${form.nav}` : ""}
                  {form.returns1Y ? ` · 1Y ${formatPercent(form.returns1Y)}` : ""}
                </p>
              </div>
              <button type="button" onClick={backToSearch} className="shrink-0 flex items-center gap-1 text-xs text-[var(--shell-text-faint)] hover:text-[var(--shell-text)]">
                <ArrowLeft className="w-3 h-3" />
                Change
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[var(--shell-text-muted)] mb-1.5 block">Amount Invested (₹)</label>
                <input
                  type="number" required value={form.investedAmount}
                  onChange={(e) => {
                    const investedAmount = +e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      investedAmount,
                      currentValue: prev.currentValue === prev.investedAmount ? investedAmount : prev.currentValue,
                      units: prev.nav ? Number((investedAmount / prev.nav).toFixed(4)) : prev.units,
                    }));
                  }}
                  className="w-full px-3 py-2.5 border border-[var(--shell-border)] rounded-xl text-sm focus:outline-none focus:border-cyan-500/40"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--shell-text-muted)] mb-1.5 block">Current Value (₹)</label>
                <input
                  type="number" value={form.currentValue}
                  onChange={(e) => setForm({ ...form, currentValue: +e.target.value })}
                  className="w-full px-3 py-2.5 border border-[var(--shell-border)] rounded-xl text-sm focus:outline-none focus:border-cyan-500/40"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-cyan-400 text-slate-950 text-sm font-semibold rounded-xl hover:bg-cyan-300 disabled:opacity-60 transition-colors">
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {submitting ? "Adding..." : "Add Fund"}
              </button>
              <button type="button" onClick={onClose}
                className="px-5 py-2.5 text-[var(--shell-text-muted)] text-sm border border-[var(--shell-border)] rounded-xl hover:bg-[var(--shell-surface-2)] transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* --- Manual entry fallback (original full form) --- */}
        {mode === "manual" && (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMode("search")}
              className="flex items-center gap-1 text-xs text-[var(--shell-text-faint)] hover:text-[var(--shell-text)]"
            >
              <ArrowLeft className="w-3 h-3" />
              Back to search
            </button>

            <div>
              <label className="text-xs font-medium text-[var(--shell-text-muted)] mb-1.5 block">Fund Name *</label>
              <input
                type="text" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Mirae Asset Large Cap Fund"
                className="w-full px-3 py-2.5 border border-[var(--shell-border)] rounded-xl text-sm focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/10"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[var(--shell-text-muted)] mb-1.5 block">Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as FundCategory })}
                  className="w-full px-3 py-2.5 border border-[var(--shell-border)] rounded-xl text-sm focus:outline-none focus:border-cyan-500/40 bg-[var(--shell-surface)]">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--shell-text-muted)] mb-1.5 block">Risk Level</label>
                <select value={form.riskLevel} onChange={(e) => setForm({ ...form, riskLevel: e.target.value as RiskLevel })}
                  className="w-full px-3 py-2.5 border border-[var(--shell-border)] rounded-xl text-sm focus:outline-none focus:border-cyan-500/40 bg-[var(--shell-surface)]">
                  {RISK_LEVELS.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--shell-text-muted)] mb-1.5 block">Amount Invested (₹)</label>
                <input type="number" value={form.investedAmount}
                  onChange={(e) => setForm({ ...form, investedAmount: +e.target.value })}
                  className="w-full px-3 py-2.5 border border-[var(--shell-border)] rounded-xl text-sm focus:outline-none focus:border-cyan-500/40" />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--shell-text-muted)] mb-1.5 block">Current Value (₹)</label>
                <input type="number" value={form.currentValue}
                  onChange={(e) => setForm({ ...form, currentValue: +e.target.value })}
                  className="w-full px-3 py-2.5 border border-[var(--shell-border)] rounded-xl text-sm focus:outline-none focus:border-cyan-500/40" />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--shell-text-muted)] mb-1.5 block">1-Year Returns (%)</label>
                <input type="number" step="0.1" value={form.returns1Y}
                  onChange={(e) => setForm({ ...form, returns1Y: +e.target.value })}
                  className="w-full px-3 py-2.5 border border-[var(--shell-border)] rounded-xl text-sm focus:outline-none focus:border-cyan-500/40" />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--shell-text-muted)] mb-1.5 block">Expense Ratio (%)</label>
                <input type="number" step="0.01" value={form.expenseRatio}
                  onChange={(e) => setForm({ ...form, expenseRatio: +e.target.value })}
                  className="w-full px-3 py-2.5 border border-[var(--shell-border)] rounded-xl text-sm focus:outline-none focus:border-cyan-500/40" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-cyan-400 text-slate-950 text-sm font-semibold rounded-xl hover:bg-cyan-300 disabled:opacity-60 transition-colors">
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {submitting ? "Adding..." : "Add Fund"}
              </button>
              <button type="button" onClick={onClose}
                className="px-5 py-2.5 text-[var(--shell-text-muted)] text-sm border border-[var(--shell-border)] rounded-xl hover:bg-[var(--shell-surface-2)] transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
