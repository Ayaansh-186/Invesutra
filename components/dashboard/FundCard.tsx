"use client";

import { useState } from "react";
import type { Fund } from "@/lib/types";
import { formatCurrency, formatPercent, getRiskBg, categoryLabel } from "@/lib/utils/format";
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, Brain } from "lucide-react";

const actionColors: Record<string, string> = {
  hold: "bg-blue-50 text-blue-700 border-blue-200",
  buy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  reduce: "bg-amber-50 text-amber-700 border-amber-200",
  exit: "bg-red-50 text-red-700 border-red-200",
};

const actionDots: Record<string, string> = {
  hold: "bg-blue-400",
  buy: "bg-emerald-500",
  reduce: "bg-amber-400",
  exit: "bg-red-500",
};

export default function FundCard({ fund, totalValue }: { fund: Fund; totalValue: number }) {
  const [expanded, setExpanded] = useState(false);
  const allocation = totalValue > 0 ? ((fund.currentValue / totalValue) * 100).toFixed(1) : "0.0";
  const gains = fund.currentValue - fund.investedAmount;
  const gainsPercent = fund.investedAmount > 0 ? (gains / fund.investedAmount) * 100 : 0;
  const up = gainsPercent >= 0;
  const action = fund.aiRecommendation?.action || "hold";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all overflow-hidden">
      {/* Main row */}
      <div className="flex items-center gap-4 p-4">
        {/* Fund icon */}
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shrink-0">
          <TrendingUp className="w-5 h-5 text-slate-500" strokeWidth={1.5} />
        </div>

        {/* Fund info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900 text-sm truncate">{fund.name || "Unnamed Fund"}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getRiskBg(fund.riskLevel)}`}>
              {fund.riskLevel.replace(/_/g, " ")}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-slate-400">{categoryLabel(fund.category)}</span>
            <span className="text-slate-200">·</span>
            <span className="text-xs text-slate-400">{allocation}% of portfolio</span>
            <span className="text-slate-200">·</span>
            <span className="text-xs text-slate-400">ER {fund.expenseRatio}%</span>
          </div>
        </div>

        {/* Financials */}
        <div className="flex items-center gap-5 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-400 mb-0.5">Invested</p>
            <p className="text-sm font-medium text-slate-600">{formatCurrency(fund.investedAmount, true)}</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-400 mb-0.5">Current</p>
            <p className="text-sm font-semibold text-slate-900">{formatCurrency(fund.currentValue, true)}</p>
          </div>
          <div className="text-right">
            <div className={`flex items-center justify-end gap-1 ${up ? "text-emerald-600" : "text-red-500"}`}>
              {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span className="text-sm font-bold">{formatPercent(gainsPercent)}</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{up ? "+" : ""}{formatCurrency(Math.abs(gains), true)}</p>
          </div>

          {/* AI rec badge */}
          {fund.aiRecommendation && (
            <div className="hidden lg:flex items-center gap-1.5">
              <span className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${actionColors[action]}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${actionDots[action]}`} />
                {action.charAt(0).toUpperCase() + action.slice(1)}
              </span>
            </div>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded AI details */}
      {expanded && fund.aiRecommendation && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
          <div className="flex items-start gap-2">
            <Brain className="w-3.5 h-3.5 text-sky-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-700">AI Recommendation</span>
                <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${actionColors[action]}`}>
                  {action.charAt(0).toUpperCase() + action.slice(1)}
                </span>
                <span className="text-xs text-slate-400">{fund.aiRecommendation.confidence}% confidence</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{fund.aiRecommendation.rationale}</p>
            </div>
          </div>

          {/* 1Y / 3Y / 5Y returns row */}
          <div className="flex gap-4 mt-3 pt-3 border-t border-slate-200">
            {[
              { label: "1Y Return", value: fund.returns1Y },
              { label: "3Y Return", value: fund.returns3Y },
              { label: "5Y Return", value: fund.returns5Y },
            ].map((r) => (
              <div key={r.label}>
                <p className="text-xs text-slate-400">{r.label}</p>
                <p className={`text-sm font-semibold ${r.value >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {formatPercent(r.value)}
                </p>
              </div>
            ))}
            {fund.benchmark && (
              <div className="ml-auto">
                <p className="text-xs text-slate-400">Benchmark</p>
                <p className="text-xs font-medium text-slate-600">{fund.benchmark}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
