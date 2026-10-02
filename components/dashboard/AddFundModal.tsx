"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { X, Loader2, AlertCircle, Search, ArrowLeft, LockKeyhole, RefreshCw } from "lucide-react";
import { categoryLabel, formatCurrencyExact, formatPercent } from "@/lib/utils/format";
import type { FundSearchResult } from "@/lib/marketData/types";
import { isRecentNav } from "@/lib/marketData/navFreshness";
import { isExchangeTradedFund } from "@/lib/marketData/amfi";
import { calculatePurchaseValues, isValidPurchaseDate, todayInIndia } from "@/lib/utils/purchase";
import { useToast } from "@/components/shared/ToastProvider";
import type { Fund } from "@/lib/types";

interface Props {
  // null  = not signed in (show sign-up CTA)
  // "needs-portfolio" = signed in but no portfolio created yet
  // string UUID = existing portfolio to add fund to
  portfolioId: string | null;
  onClose: () => void;
  onAdded: () => void;
  holdingToRepair?: Fund;
}

function hasRecentPrice(fund: FundSearchResult): boolean {
  return !isExchangeTradedFund(fund.name) && fund.dataQuality === "live" && isRecentNav(fund.asOf) &&
    Number.isFinite(fund.nav) && (fund.nav || 0) > 0 && /^\d+$/.test(fund.symbol || "");
}

export default function AddFundModal({ portfolioId, onClose, onAdded, holdingToRepair }: Props) {
  const titleId = useId();
  const searchResultsId = useId();
  const purchaseNavId = useId();
  const unitsId = useId();
  const purchaseDateId = useId();
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

  const [mode, setMode] = useState<"search" | "selected">("search");
  const [query, setQuery] = useState(holdingToRepair?.schemeCode || holdingToRepair?.name || "");
  const [plan, setPlan] = useState("all");
  const [option, setOption] = useState("all");
  const [results, setResults] = useState<FundSearchResult[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [selectedFund, setSelectedFund] = useState<FundSearchResult | null>(null);

  const [purchaseNav, setPurchaseNav] = useState("");
  const [units, setUnits] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [verifiedPurchaseNav, setVerifiedPurchaseNav] = useState<number | null>(null);
  const [checkingNav, setCheckingNav] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteRetry, setQuoteRetry] = useState(0);
  const [resolvedPortfolioId, setResolvedPortfolioId] = useState(portfolioId);
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestNav = selectedFund?.dataQuality === "live" && isRecentNav(selectedFund.asOf) ? selectedFund.nav || 0 : 0;
  const purchaseMatches = verifiedPurchaseNav !== null && Number(purchaseNav) > 0 &&
    Math.abs(Number(purchaseNav) - verifiedPurchaseNav) <= Math.max(0.001, verifiedPurchaseNav * 0.0001);
  const values = purchaseMatches ? calculatePurchaseValues(verifiedPurchaseNav!, Number(units), latestNav) : null;
  const purchaseDateValid = isValidPurchaseDate(purchaseDate);

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
        const res = await fetch(`/api/funds/search?q=${encodeURIComponent(query.trim())}&plan=${plan}&option=${option}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Fund search is unavailable.");
        if (seq !== searchSeq.current) return; // a newer search superseded this one
        setResults((data.funds || []).filter((fund: FundSearchResult) => !holdingToRepair?.schemeCode || fund.symbol === holdingToRepair.schemeCode));
        setSearchMessage(data.message || null);
        setHighlightedIndex(-1);
      } catch (searchError) {
        if (searchError instanceof DOMException && searchError.name === "AbortError") return;
        if (seq === searchSeq.current) setSearchMessage("Search is unavailable. Please try again later.");
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, mode, plan, option, holdingToRepair?.schemeCode]);

  useEffect(() => {
    if (mode !== "selected" || !selectedFund?.symbol || !isValidPurchaseDate(purchaseDate)) return;
    const controller = new AbortController();
    setCheckingNav(true);
    setQuoteError(null);
    fetch(`/api/funds/details?schemeCode=${selectedFund.symbol}&purchaseDate=${purchaseDate}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Purchase NAV could not be verified.");
        if (controller.signal.aborted) return;
        setVerifiedPurchaseNav(data.purchase.nav);
        setPurchaseNav(String(data.purchase.nav));
        setSelectedFund((fund) => fund ? { ...fund, nav: data.fund.nav, asOf: data.fund.navAsOf, sourceUrl: data.fund.sourceUrl } : null);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setVerifiedPurchaseNav(null);
        setQuoteError(reason instanceof Error ? reason.message : "Purchase NAV lookup failed.");
      })
      .finally(() => { if (!controller.signal.aborted) setCheckingNav(false); });
    return () => controller.abort();
  }, [mode, selectedFund?.symbol, purchaseDate, quoteRetry]);

  function updatePurchaseDate(date: string) {
    setPurchaseDate(date);
    setPurchaseNav("");
    setVerifiedPurchaseNav(null);
    setQuoteError(null);
    setCheckingNav(isValidPurchaseDate(date));
  }

  function selectFund(fund: FundSearchResult) {
    if (!hasRecentPrice(fund)) return;
    setSelectedFund(fund);
    setPurchaseNav("");
    setUnits(holdingToRepair && holdingToRepair.units > 0 ? String(holdingToRepair.units) : "");
    setPurchaseDate(holdingToRepair?.purchaseDate && isValidPurchaseDate(holdingToRepair.purchaseDate) ? holdingToRepair.purchaseDate : "");
    setVerifiedPurchaseNav(null);
    setQuoteError(null);
    setCheckingNav(false);
    setError(null);
    setMode("selected");
  }

  function backToSearch() {
    setSelectedFund(null);
    setMode("search");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFund?.symbol || !latestNav || !values || !purchaseDateValid) {
      setError("Enter a valid purchase NAV, units, and purchase date for a fund with a recent NAV.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      let pid = resolvedPortfolioId;

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
        if (pid) setResolvedPortfolioId(pid);
      }

      if (!pid) { setError("No portfolio found."); setSubmitting(false); return; }

      const res = await fetch(holdingToRepair ? `/api/funds/${holdingToRepair.id}/purchase` : `/api/portfolios/${pid}/funds`, {
        method: holdingToRepair ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemeCode: selectedFund.symbol,
          purchaseNav: Number(purchaseNav),
          units: Number(units),
          purchaseDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Could not save purchase details."); setSubmitting(false); return; }
      onAdded();
      showToast(holdingToRepair ? "Purchase details corrected" : `Added ${selectedFund.name} to your portfolio`, "success");
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
          className="bg-[var(--shell-surface)] rounded-lg max-w-sm w-full p-6 text-center shadow-2xl"
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
            className="app-primary-button mb-3 w-full"
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
        className="bg-[var(--shell-surface)] rounded-lg max-w-lg w-full max-h-[90dvh] overflow-y-auto shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 p-5 border-b border-[var(--shell-border)] sticky top-0 bg-[var(--shell-surface)] rounded-t-lg z-10">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-[var(--shell-text)]">{holdingToRepair ? "Correct holding" : "Add mutual fund"}</h2>
            <p className="text-xs text-[var(--shell-text-faint)] mt-0.5">
              {mode === "search" && "Find your fund"}
              {mode === "selected" && "Enter your purchase"}
            </p>
          </div>
          <button aria-label="Close add fund dialog" onClick={onClose} className="app-icon-button">
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
                  const selectable = results.flatMap((fund, index) => hasRecentPrice(fund) ? [index] : []);
                  if (selectable.length === 0) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlightedIndex((i) => selectable[(selectable.indexOf(i) + 1) % selectable.length]);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlightedIndex((i) => i < 0
                      ? selectable[selectable.length - 1]
                      : selectable[(selectable.indexOf(i) - 1 + selectable.length) % selectable.length]);
                  } else if (e.key === "Enter" && highlightedIndex >= 0) {
                    e.preventDefault();
                    selectFund(results[highlightedIndex]);
                  }
                }}
                placeholder="e.g. HDFC Flexi Cap, Mirae Asset Large Cap..."
                role="combobox"
                aria-label="Search mutual funds"
                aria-autocomplete="list"
                aria-expanded={results.length > 0}
                aria-controls={searchResultsId}
                aria-busy={searching}
                aria-activedescendant={highlightedIndex >= 0 ? `${searchResultsId}-${highlightedIndex}` : undefined}
                className="w-full pl-9 pr-9 py-2.5 border border-[var(--shell-border)] rounded-lg text-sm focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/10"
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--shell-text-faint)] animate-spin" />}
            </div>

            {query.trim().length > 0 && query.trim().length < 2 && (
              <p className="text-xs text-[var(--shell-text-faint)]">Keep typing — at least 2 characters.</p>
            )}

            <div className="flex flex-wrap gap-2">
              <select aria-label="Fund plan" value={plan} onChange={(e) => { setPlan(e.target.value); updateQuery(query); }} className="h-10 rounded-md border border-[var(--shell-border)] bg-[var(--shell-surface)] px-2 text-xs text-[var(--shell-text)]">
                <option value="all">All plans</option><option value="direct">Direct</option><option value="regular">Regular</option>
              </select>
              <select aria-label="Fund option" value={option} onChange={(e) => { setOption(e.target.value); updateQuery(query); }} className="h-10 rounded-md border border-[var(--shell-border)] bg-[var(--shell-surface)] px-2 text-xs text-[var(--shell-text)]">
                <option value="all">All options</option><option value="growth">Growth</option><option value="idcw">IDCW</option>
              </select>
            </div>

            {results.length > 0 && (
              <div id={searchResultsId} role="listbox" className="space-y-1.5 max-h-72 overflow-y-auto">
                {results.map((fund, i) => {
                  const canPrice = hasRecentPrice(fund);
                  return (
                    <button
                      key={`${fund.symbol || fund.name}-${i}`}
                      type="button"
                      id={`${searchResultsId}-${i}`}
                      role="option"
                      aria-selected={i === highlightedIndex}
                      disabled={!canPrice}
                      onClick={() => selectFund(fund)}
                      onMouseEnter={() => { if (canPrice) setHighlightedIndex(i); }}
                      className={`group w-full rounded-lg border border-[var(--shell-border)] bg-[var(--shell-surface)] p-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400/20 ${
                        !canPrice ? "cursor-not-allowed opacity-60" : i === highlightedIndex ? "border-cyan-400/50 bg-cyan-400/10" : "hover:border-cyan-400/50 hover:bg-cyan-400/10"
                      }`}
                    >
                      <p className="break-words text-sm font-medium leading-snug text-[var(--shell-text)] group-hover:text-cyan-600">{fund.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--shell-text-faint)]">
                        {fund.category && <span className="rounded-md bg-[var(--shell-surface-2)] px-1.5 py-0.5">{categoryLabel(fund.category)}</span>}
                        {canPrice && fund.nav !== undefined && <span>NAV ₹{fund.nav}</span>}
                        {canPrice && fund.returns1Y !== undefined && <span>1Y {formatPercent(fund.returns1Y)}</span>}
                        {fund.planType && fund.planType !== "unknown" && <span className="capitalize">{fund.planType}</span>}
                        {fund.optionType && fund.optionType !== "unknown" && <span className="capitalize">{fund.optionType}</span>}
                        {fund.asOf && <span>{canPrice ? "NAV date" : "Last NAV"} {fund.asOf}</span>}
                        {fund.symbol && <span>Scheme {fund.symbol}</span>}
                        {!canPrice && <span className="text-amber-600">{isExchangeTradedFund(fund.name) ? "ETF market price unavailable" : "Recent NAV unavailable"}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {!searching && query.trim().length >= 2 && results.length === 0 && (
              <p role="status" className="text-xs text-[var(--shell-text-faint)]">{searchMessage || "No matching funds found."}</p>
            )}

            <p className="text-xs text-[var(--shell-text-faint)]">Latest published NAVs · <a href="https://portal.amfiindia.com/spages/NAVAll.txt" target="_blank" rel="noopener noreferrer" className="underline">AMFI</a></p>
          </div>
        )}

        {/* --- Step 2 (from search): confirm amount --- */}
        {mode === "selected" && (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div role="alert" className="flex items-start gap-2 p-3 bg-rose-500/5 border border-rose-500/20 rounded-lg text-xs text-rose-700 dark:text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-start justify-between gap-3 border-b border-[var(--shell-border)] pb-4">
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold text-[var(--shell-text)]">{selectedFund?.name}</p>
                <p className="mt-1 text-xs text-[var(--shell-text-faint)]">
                  {selectedFund?.category && categoryLabel(selectedFund.category)}
                  {selectedFund?.asOf && ` · Latest NAV ${formatCurrencyExact(latestNav, 5)} as of ${selectedFund.asOf}`}
                </p>
              </div>
              <button type="button" onClick={backToSearch} className="shrink-0 flex items-center gap-1 text-xs text-[var(--shell-text-faint)] hover:text-[var(--shell-text)]">
                <ArrowLeft className="w-3 h-3" />
                Change
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={purchaseDateId} className="mb-1.5 block text-xs font-medium text-[var(--shell-text-muted)]">Allotment date</label>
                <input id={purchaseDateId} type="date" required value={purchaseDate} max={todayInIndia()} onChange={(e) => updatePurchaseDate(e.target.value)} className="w-full rounded-md border border-[var(--shell-border)] bg-[var(--shell-surface)] px-3 py-2.5 text-sm text-[var(--shell-text)] focus:outline-none focus:border-cyan-500/40" />
              </div>
              <div>
                <label htmlFor={purchaseNavId} className="mb-1.5 block text-xs font-medium text-[var(--shell-text-muted)]">Buying NAV (₹ per unit)</label>
                <input
                  id={purchaseNavId}
                  type="number" required value={purchaseNav}
                  min="0.0001" step="any" inputMode="decimal"
                  disabled={verifiedPurchaseNav === null || checkingNav}
                  placeholder={checkingNav ? "Checking published NAV..." : "Select an allotment date"}
                  onChange={(e) => setPurchaseNav(e.target.value)}
                  className="w-full rounded-md border border-[var(--shell-border)] bg-[var(--shell-surface)] px-3 py-2.5 text-sm text-[var(--shell-text)] focus:outline-none focus:border-cyan-500/40"
                />
              </div>
              <div>
                <label htmlFor={unitsId} className="mb-1.5 block text-xs font-medium text-[var(--shell-text-muted)]">Units purchased</label>
                <input
                  id={unitsId}
                  type="number" required value={units}
                  min="0.0001" step="0.0001" inputMode="decimal"
                  onChange={(e) => setUnits(e.target.value)}
                  className="w-full rounded-md border border-[var(--shell-border)] bg-[var(--shell-surface)] px-3 py-2.5 text-sm text-[var(--shell-text)] focus:outline-none focus:border-cyan-500/40"
                />
              </div>
            </div>

            {checkingNav && <p role="status" className="text-xs text-[var(--shell-text-muted)]">Checking the published NAV for your allotment date...</p>}
            {quoteError && <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-amber-600"><p>{quoteError}</p><button type="button" onClick={() => setQuoteRetry((value) => value + 1)} className="inline-flex items-center gap-1 underline"><RefreshCw className="h-3 w-3" />Retry NAV lookup</button></div>}
            {verifiedPurchaseNav !== null && !checkingNav && <p className={`text-xs ${purchaseMatches ? "text-[var(--shell-text-faint)]" : "text-amber-600"}`}>Published buying NAV: {formatCurrencyExact(verifiedPurchaseNav, 5)} on {purchaseDate}{!purchaseMatches && ". The entered price must match this NAV."}</p>}

            <div aria-live="polite" className="border-t border-[var(--shell-border)] pt-4">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-[var(--shell-text-muted)]">Amount invested</span>
                <strong className="tabular-nums text-[var(--shell-text)]">{values ? formatCurrencyExact(values.investedAmount) : "—"}</strong>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-3 text-sm">
                <span className="text-[var(--shell-text-muted)]">Value at latest NAV</span>
                <strong className="tabular-nums text-[var(--shell-text)]">{values ? formatCurrencyExact(values.currentValue) : "—"}</strong>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={submitting || checkingNav || !purchaseMatches || !values || !purchaseDateValid || !latestNav}
                className="app-primary-button flex-1">
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {submitting ? "Saving..." : holdingToRepair ? "Save correction" : "Add Fund"}
              </button>
              <button type="button" onClick={onClose}
                className="app-secondary-button">
                Cancel
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
