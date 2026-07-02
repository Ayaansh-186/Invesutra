"use client";

import { useState } from "react";
import Link from "next/link";
import { X, Loader2, AlertCircle } from "lucide-react";
import { categoryLabel } from "@/lib/utils/format";
import type { Fund, FundCategory, RiskLevel } from "@/lib/types";

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

export default function AddFundModal({ portfolioId, onClose, onAdded }: Props) {
  const [form, setForm] = useState({
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
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl max-w-sm w-full p-8 text-center shadow-2xl">
          <div className="w-12 h-12 bg-sky-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔐</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Sign in to add funds</h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Create a free Invesutra account to build and save your own portfolio.
          </p>
          <Link
            href="/auth/signup"
            className="block w-full py-3 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors mb-3"
          >
            Create free account
          </Link>
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Add Mutual Fund</h2>
            <p className="text-xs text-slate-400 mt-0.5">Enter your fund details to start tracking</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Fund Name *</label>
            <input
              type="text" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Mirae Asset Large Cap Fund"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as FundCategory })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-400 bg-white">
                {CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Risk Level</label>
              <select value={form.riskLevel} onChange={(e) => setForm({ ...form, riskLevel: e.target.value as RiskLevel })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-400 bg-white">
                {RISK_LEVELS.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Amount Invested (₹)</label>
              <input type="number" value={form.investedAmount}
                onChange={(e) => setForm({ ...form, investedAmount: +e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Current Value (₹)</label>
              <input type="number" value={form.currentValue}
                onChange={(e) => setForm({ ...form, currentValue: +e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">1-Year Returns (%)</label>
              <input type="number" step="0.1" value={form.returns1Y}
                onChange={(e) => setForm({ ...form, returns1Y: +e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Expense Ratio (%)</label>
              <input type="number" step="0.01" value={form.expenseRatio}
                onChange={(e) => setForm({ ...form, expenseRatio: +e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-400" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-60 transition-colors">
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {submitting ? "Adding..." : "Add Fund"}
            </button>
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 text-slate-600 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
