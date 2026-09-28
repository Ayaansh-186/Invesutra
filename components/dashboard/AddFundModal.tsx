"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { X, Loader2, AlertCircle, Search, ArrowLeft, ChevronDown, LockKeyhole } from "lucide-react";
import { categoryLabel, formatPercent } from "@/lib/utils/format";
import type { FundCategory, RiskLevel } from "@/lib/types";
import type { FundSearchResult } from "@/lib/marketData/types";
import { isRecentNav } from "@/lib/marketData/navFreshness";
import { useToast } from "@/components/shared/ToastProvider";

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
  investedAmount: 0,
  currentValue: 0,
  returns1Y: 0,
  riskLevel: "moderately_high" as RiskLevel,
  expenseRatio: 0,
  nav: 0,
  units: 0,
  returns3Y: 0,
  returns5Y: 0,
  aum: 0,
  benchmark: "",
  manager: "",
};

export default function AddFundModal({ portfolioId, onClose, onAdded }: Props) {
  const titleId = useId();
  const searchResultsId = useId();
  const investedAmountId = useId();
  const currentValueId = useId();
  // Escape closes the modal, like every other modal a user expects this
  // from — previously the only way out was the X or Cancel button.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const [mode, setMode] = useState<"search" | "manual" | "selected">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FundSearchResult[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [selectedFund, setSelectedFund] = useState<FundSearchResult | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [currentValueEntered, setCurrentValueEntered] = useState(false);
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced search against the MCP-backed fund data (real AMFI schemes).
  const searchSeq = useRef(0);
  function updateQuery(nextQuery: string) {
    searchSeq.current += 1;
    setQuery(nextQuery);
    setResults([]);
    setHighlightedIndex(-1);
    setSearchMessage(null);
    setSearching(nextQuery.trim().length >= 2);
  }

  useEffect(() => {
    if (mode !== "search") return;
    if (query.trim().length < 2) {
      setSearching(false);
      return;
    }
    const seq = ++searchSeq.current;
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/funds/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Fund search is unavailable.");
        if (seq !== searchSeq.current) return; // a newer search superseded this one
        setResults(data.funds || []);
        setSearchMessage(data.message || null);
        setHighlightedIndex(-1);
      } catch (searchError) {
        if (searchError instanceof DOMException && searchError.name === "AbortError") return;
        if (seq === searchSeq.current) setSearchMessage("Search is unavailable. You can still add this fund manually.");
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, mode]);

  function selectFund(fund: FundSearchResult) {
    const hasFreshNav = fund.dataQuality === "live" && isRecentNav(fund.asOf) && Number.isFinite(fund.nav) && (fund.nav ?? 0) > 0;
    setSelectedFund(fund);
    setCurrentValueEntered(false);
    setForm({
      ...emptyForm,
      name: fund.name,
      category: fund.category || emptyForm.category,
      riskLevel: fund.riskLevel || emptyForm.riskLevel,
      nav: hasFreshNav ? fund.nav! : 0,
      returns1Y: hasFreshNav ? fund.returns1Y ?? 0 : 0,
      returns3Y: hasFreshNav ? fund.returns3Y ?? 0 : 0,
      returns5Y: hasFreshNav ? fund.returns5Y ?? 0 : 0,
      expenseRatio: fund.expenseRatio ?? 0,
      aum: fund.aum ?? 0,
      benchmark: fund.benchmark ?? "",
    });
    setError(null);
    setMode("selected");
  }

  function backToSearch() {
    setSelectedFund(null);
    setMode("search");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Fund name is required."); return; }
    if (!Number.isFinite(form.investedAmount) || form.investedAmount <= 0) {
      setError("Invested amount must be greater than 0.");
      return;
    }
    if (!currentValueEntered) {
      setError("Enter the current value from your statement, even if it is 0.");
      return;
    }
    if (!Number.isFinite(form.currentValue) || form.currentValue < 0) {
      setError("Current value must be 0 or greater.");
      return;
    }
    if (!Number.isFinite(form.units) || form.units < 0) {
      setError("Units must be 0 or greater.");
      return;
    }
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
      showToast(`Added ${form.name} to your portfolio`, "success");
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  // Not signed in at all
  if (portfolioId === null) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="bg-[var(--shell-surface)] rounded-2xl max-w-sm w-full p-8 text-center shadow-2xl"
        >
          <div className="w-12 h-12 bg-cyan-400/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <LockKeyhole className="h-5 w-5 text-cyan-500" />
          </div>
          <h2 id={titleId} className="text-lg font-bold text-[var(--shell-text)] mb-2">Sign in to add funds</h2>
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-[var(--shell-surface)] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-[var(--shell-border)] sticky top-0 bg-[var(--shell-surface)] rounded-t-2xl z-10">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-[var(--shell-text)]">Add mutual fund</h2>
            <p className="text-xs text-[var(--shell-text-faint)] mt-0.5">
              {mode === "search" && "Find your fund"}
              {mode === "selected" && "Add your holding"}
              {mode === "manual" && "Enter a fund manually"}
            </p>
          </div>
          <button aria-label="Close add fund dialog" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--shell-surface-2)] text-[var(--shell-text-faint)] transition-colors">
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
                onChange={(e) => updateQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (results.length === 0) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlightedIndex((i) => (i + 1) % results.length);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlightedIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
                  } else if (e.key === "Enter" && highlightedIndex >= 0) {
                    e.preventDefault();
                    selectFund(results[highlightedIndex]);
                  }
                }}
                placeholder="e.g. HDFC Flexi Cap, Mirae Asset Large Cap..."
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={results.length > 0}
                aria-controls={searchResultsId}
                aria-busy={searching}
                aria-activedescendant={highlightedIndex >= 0 ? `${searchResultsId}-${highlightedIndex}` : undefined}
                className="w-full pl-9 pr-3 py-2.5 border border-[var(--shell-border)] rounded-xl text-sm focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/10"
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--shell-text-faint)] animate-spin" />}
            </div>

            {query.trim().length > 0 && query.trim().length < 2 && (
              <p className="text-xs text-[var(--shell-text-faint)]">Keep typing — at least 2 characters.</p>
            )}

            {results.length > 0 && (
              <div id={searchResultsId} role="listbox" className="space-y-1.5 max-h-72 overflow-y-auto">
                {results.map((fund, i) => (
                  <button
                    key={`${fund.symbol || fund.name}-${i}`}
                    type="button"
                    id={`${searchResultsId}-${i}`}
                    role="option"
                    aria-selected={i === highlightedIndex}
                    onClick={() => selectFund(fund)}
                    onMouseEnter={() => setHighlightedIndex(i)}
                    className={`group w-full text-left p-3 border border-[var(--shell-border)] rounded-xl bg-[var(--shell-surface)] focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition-colors ${
                      i === highlightedIndex ? "border-cyan-400/50 bg-cyan-400/10" : "hover:border-cyan-400/50 hover:bg-cyan-400/10"
                    }`}
                  >
                    <p className="break-words text-sm font-medium leading-snug text-[var(--shell-text)] group-hover:text-cyan-600">{fund.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--shell-text-faint)]">
                      {fund.category && (
                        <span className="px-1.5 py-0.5 bg-[var(--shell-surface-2)] rounded-md">{categoryLabel(fund.category)}</span>
                      )}
                      {fund.dataQuality === "live" && fund.nav !== undefined && <span>NAV ₹{fund.nav}</span>}
                      {fund.dataQuality === "live" && fund.returns1Y !== undefined && <span>1Y {formatPercent(fund.returns1Y)}</span>}
                      {fund.planType && fund.planType !== "unknown" && <span className="capitalize">{fund.planType}</span>}
                      {fund.optionType && fund.optionType !== "unknown" && <span className="capitalize">{fund.optionType}</span>}
                      {fund.asOf && <span>{fund.dataQuality === "live" ? "NAV date" : "Last NAV"} {fund.asOf}</span>}
                      {fund.dataQuality === "fallback" && <span className="text-amber-500">Fallback listing</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!searching && query.trim().length >= 2 && results.length === 0 && (
              <p role="status" className="text-xs text-[var(--shell-text-faint)]">{searchMessage || "No matching funds found."}</p>
            )}

            <button
              type="button"
              onClick={() => { setForm(emptyForm); setCurrentValueEntered(false); setMode("manual"); }}
              className="inline-flex rounded-lg px-1 py-0.5 text-xs font-medium text-[var(--shell-text-faint)] hover:text-[var(--shell-text)] focus:outline-none focus:ring-2 focus:ring-cyan-400/20 underline underline-offset-2"
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

            <div className="flex items-start justify-between gap-3 border-b border-[var(--shell-border)] pb-4">
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold text-[var(--shell-text)]">{form.name}</p>
                <p className="mt-1 text-xs text-[var(--shell-text-faint)]">{categoryLabel(form.category)}</p>
              </div>
              <button type="button" onClick={backToSearch} className="shrink-0 flex items-center gap-1 text-xs text-[var(--shell-text-faint)] hover:text-[var(--shell-text)]">
                <ArrowLeft className="w-3 h-3" />
                Change
              </button>
            </div>

            {selectedFund && form.nav === 0 && (
              <p className="rounded-md border border-amber-300/60 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                {selectedFund.asOf ? `Last NAV: ${selectedFund.asOf}. This NAV cannot be used for a current valuation. ` : "Current NAV is unavailable. "}
                Enter the current value shown in your statement. Automatic NAV updates will stay off.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={investedAmountId} className="text-xs font-medium text-[var(--shell-text-muted)] mb-1.5 block">Amount Invested (₹)</label>
                <input
                  id={investedAmountId}
                  type="number" required value={form.investedAmount || ""}
                  min="0.01" step="0.01" inputMode="decimal"
                  onChange={(e) => {
                    const investedAmount = +e.target.value;
                    setForm((prev) => ({ ...prev, investedAmount }));
                  }}
                  className="w-full px-3 py-2.5 border border-[var(--shell-border)] rounded-xl text-sm focus:outline-none focus:border-cyan-500/40"
                />
              </div>
              <div>
                <label htmlFor={currentValueId} className="text-xs font-medium text-[var(--shell-text-muted)] mb-1.5 block">Current Value (₹)</label>
                <input
                  id={currentValueId}
                  type="number" required value={currentValueEntered ? form.currentValue : ""}
                  min="0" step="0.01" inputMode="decimal"
                  onChange={(e) => { setCurrentValueEntered(e.target.value !== ""); setForm({ ...form, currentValue: +e.target.value, units: 0 }); }}
                  className="w-full px-3 py-2.5 border border-[var(--shell-border)] rounded-xl text-sm focus:outline-none focus:border-cyan-500/40"
                />
              </div>
            </div>

            <details className="group border-t border-[var(--shell-border)] pt-3">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-[var(--shell-text-muted)] marker:hidden">
                Advanced details <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-4 space-y-3">
                {form.nav > 0 && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--shell-text-muted)]">Units held (optional)</label>
                    <input type="number" value={form.units || ""} min="0" step="0.0001" inputMode="decimal"
                      onChange={(e) => {
                        const units = +e.target.value;
                        if (units > 0) setCurrentValueEntered(true);
                        setForm((prev) => ({ ...prev, units, currentValue: units > 0 ? Number((units * prev.nav).toFixed(2)) : prev.currentValue }));
                      }}
                      className="w-full rounded-md border border-[var(--shell-border)] bg-[var(--shell-surface)] px-3 py-2.5 text-sm text-[var(--shell-text)]" />
                    <p className="mt-1 text-xs text-[var(--shell-text-faint)]">Uses the recent NAV of ₹{form.nav} to calculate current value and enable refreshes.</p>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {(selectedFund?.returns1Y === undefined || form.nav === 0) && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[var(--shell-text-muted)]">1-year return (%)</label>
                      <input
                        type="number" step="0.01" value={form.returns1Y || ""} placeholder="Unavailable"
                        onChange={(e) => setForm({ ...form, returns1Y: +e.target.value })}
                        className="w-full rounded-md border border-[var(--shell-border)] bg-[var(--shell-surface)] px-3 py-2.5 text-sm text-[var(--shell-text)] focus:outline-none focus:border-cyan-500/40"
                      />
                    </div>
                  )}
                  {selectedFund?.expenseRatio === undefined && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[var(--shell-text-muted)]">Expense ratio (%)</label>
                      <input
                        type="number" min="0" step="0.01" value={form.expenseRatio || ""} placeholder="Unavailable"
                        onChange={(e) => setForm({ ...form, expenseRatio: +e.target.value })}
                        className="w-full rounded-md border border-[var(--shell-border)] bg-[var(--shell-surface)] px-3 py-2.5 text-sm text-[var(--shell-text)] focus:outline-none focus:border-cyan-500/40"
                      />
                    </div>
                  )}
                </div>
                <p className="text-xs leading-relaxed text-[var(--shell-text-faint)]">Only enter verified figures. Missing metrics are saved as zero and may affect analysis.</p>
              </div>
            </details>

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

        {/* --- Manual entry --- */}
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

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={investedAmountId} className="text-xs font-medium text-[var(--shell-text-muted)] mb-1.5 block">Amount Invested (₹)</label>
                <input id={investedAmountId} type="number" required value={form.investedAmount || ""}
                  min="0.01" step="0.01" inputMode="decimal"
                  onChange={(e) => setForm({ ...form, investedAmount: +e.target.value })}
                  className="w-full px-3 py-2.5 border border-[var(--shell-border)] rounded-xl text-sm focus:outline-none focus:border-cyan-500/40" />
              </div>
              <div>
                <label htmlFor={currentValueId} className="text-xs font-medium text-[var(--shell-text-muted)] mb-1.5 block">Current Value (₹)</label>
                <input id={currentValueId} type="number" required value={currentValueEntered ? form.currentValue : ""}
                  min="0" step="0.01" inputMode="decimal"
                  onChange={(e) => { setCurrentValueEntered(e.target.value !== ""); setForm({ ...form, currentValue: +e.target.value }); }}
                  className="w-full px-3 py-2.5 border border-[var(--shell-border)] rounded-xl text-sm focus:outline-none focus:border-cyan-500/40" />
              </div>
            </div>

            <details className="group border-t border-[var(--shell-border)] pt-3">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-[var(--shell-text-muted)] marker:hidden">
                Advanced details <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-xs leading-relaxed text-[var(--shell-text-faint)]">Review category and risk for more accurate analysis. Only enter returns and expenses when verified.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-[var(--shell-text-muted)] mb-1.5 block">Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as FundCategory })}
                  className="w-full px-3 py-2.5 border border-[var(--shell-border)] rounded-md text-sm focus:outline-none focus:border-cyan-500/40 bg-[var(--shell-surface)]">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--shell-text-muted)] mb-1.5 block">Risk level</label>
                <select value={form.riskLevel} onChange={(e) => setForm({ ...form, riskLevel: e.target.value as RiskLevel })}
                  className="w-full px-3 py-2.5 border border-[var(--shell-border)] rounded-md text-sm focus:outline-none focus:border-cyan-500/40 bg-[var(--shell-surface)]">
                  {RISK_LEVELS.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--shell-text-muted)] mb-1.5 block">1-Year Returns (%)</label>
                <input type="number" step="0.1" value={form.returns1Y || ""} placeholder="Unavailable"
                  onChange={(e) => setForm({ ...form, returns1Y: +e.target.value })}
                  className="w-full px-3 py-2.5 border border-[var(--shell-border)] rounded-xl text-sm focus:outline-none focus:border-cyan-500/40" />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--shell-text-muted)] mb-1.5 block">Expense Ratio (%)</label>
                <input type="number" step="0.01" value={form.expenseRatio || ""} placeholder="Unavailable"
                  onChange={(e) => setForm({ ...form, expenseRatio: +e.target.value })}
                  className="w-full px-3 py-2.5 border border-[var(--shell-border)] rounded-xl text-sm focus:outline-none focus:border-cyan-500/40" />
              </div>
              </div>
            </details>

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
