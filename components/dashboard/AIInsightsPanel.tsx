"use client";

import { useState } from "react";
import { Brain, AlertTriangle, AlertCircle, ChevronDown, ChevronUp, Lightbulb, TrendingUp, Shield } from "lucide-react";
import type { ConcentrationRisk } from "@/lib/types";

const INSIGHT_ICONS = [Brain, TrendingUp, Shield, Lightbulb, AlertTriangle];

function getInsightTone(insight: string): { border: string; bg: string; icon: string; dot: string } {
  const normalized = insight.toLowerCase();
  if (normalized.includes("high") || normalized.includes("exceeds"))
    return { border: "border-amber-200", bg: "bg-amber-50", icon: "text-amber-600", dot: "bg-amber-400" };
  if (normalized.includes("healthy") || normalized.includes("good"))
    return { border: "border-emerald-200", bg: "bg-emerald-50", icon: "text-emerald-600", dot: "bg-emerald-400" };
  if (normalized.includes("underperform") || normalized.includes("low"))
    return { border: "border-red-200", bg: "bg-red-50", icon: "text-red-500", dot: "bg-red-400" };
  return { border: "border-sky-200", bg: "bg-sky-50", icon: "text-sky-600", dot: "bg-sky-400" };
}

export default function AIInsightsPanel({
  insights,
  risks,
}: {
  insights: string[];
  risks: ConcentrationRisk[];
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-900">AI Portfolio Intelligence</p>
            <p className="text-xs text-slate-400 mt-0.5">{insights.length} insights detected</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {risks.filter((risk) => risk.severity === "critical").length > 0 && (
            <span className="px-2 py-0.5 bg-red-50 text-red-700 text-xs font-semibold rounded-full border border-red-200">
              {risks.filter((risk) => risk.severity === "critical").length} critical
            </span>
          )}
          {risks.filter((risk) => risk.severity === "warning").length > 0 && (
            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full border border-amber-200">
              {risks.filter((risk) => risk.severity === "warning").length} warnings
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-3">
          {risks.map((risk, index) => (
            <div
              key={`${risk.label}-${index}`}
              className={`flex items-start gap-3 p-4 rounded-xl border ${
                risk.severity === "critical" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
              }`}
            >
              {risk.severity === "critical" ? (
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              )}
              <div>
                <p className={`text-xs font-semibold ${risk.severity === "critical" ? "text-red-800" : "text-amber-800"}`}>
                  {risk.label}
                </p>
                <p className={`text-xs mt-0.5 leading-relaxed ${risk.severity === "critical" ? "text-red-600" : "text-amber-600"}`}>
                  Current exposure {risk.currentPercent.toFixed(1)}% exceeds the recommended {risk.recommendedMax}% limit.
                </p>
              </div>
            </div>
          ))}

          {insights.map((insight, index) => {
            const tone = getInsightTone(insight);
            const Icon = INSIGHT_ICONS[index % INSIGHT_ICONS.length];
            return (
              <div key={`${insight}-${index}`} className={`flex items-start gap-3 p-4 rounded-xl border ${tone.border} ${tone.bg}`}>
                <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${tone.icon}`} />
                <p className="text-xs text-slate-700 leading-relaxed">{insight}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
