"use client";

import { useState } from "react";
import { runSimulation } from "@/lib/algorithm/simulationEngine";
import type { SimulationInput, SimulationResult } from "@/lib/types";
import { formatCurrency, formatPercent } from "@/lib/utils/format";
import SimulatorChart from "@/components/simulator/SimulatorChart";
import { Play, RefreshCw, TrendingUp, BarChart2, Zap, Shield, PieChart } from "lucide-react";
import { categoryLabel } from "@/lib/utils/format";

const DEFAULT_INPUT: SimulationInput = {
  initialInvestment: 500000,
  monthlyAddition: 10000,
  years: 10,
  expectedReturn: 14,
  marketCondition: "bull",
  triggerPercent: 12,
  enableRebalancing: true,
  funds: [
    { name: "Large Cap", allocation: 40, expectedReturn: 13, category: "large_cap", riskLevel: "moderately_high" },
    { name: "Mid Cap", allocation: 30, expectedReturn: 16, category: "mid_cap", riskLevel: "high" },
    { name: "Debt Fund", allocation: 20, expectedReturn: 7, category: "debt", riskLevel: "low" },
    { name: "Index Fund", allocation: 10, expectedReturn: 13, category: "index", riskLevel: "moderately_high" },
  ],
};

export default function SimulatorPage() {
  const [input, setInput] = useState<SimulationInput>(DEFAULT_INPUT);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [running, setRunning] = useState(false);

  function handleRun() {
    setRunning(true);
    setTimeout(() => {
      const res = runSimulation(input);
      setResult(res);
      setRunning(false);
    }, 800);
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--shell-text)] mb-1">Portfolio Simulator</h1>
        <p className="text-sm text-[var(--shell-text-faint)]">
          Simulate portfolio growth with the QuantRebalance Protocol and compare strategies
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Input panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-[var(--shell-text)] mb-4">Simulation Parameters</h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[var(--shell-text-muted)] mb-1 block">Initial Investment</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--shell-text-faint)] text-sm">₹</span>
                  <input
                    type="number"
                    value={input.initialInvestment}
                    onChange={e => setInput({...input, initialInvestment: +e.target.value})}
                    className="w-full pl-7 pr-3 py-2.5 border border-[var(--shell-border)] bg-[var(--shell-surface)] rounded-lg text-sm text-[var(--shell-text)] focus:outline-none focus:border-cyan-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--shell-text-muted)] mb-1 block">Monthly SIP Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--shell-text-faint)] text-sm">₹</span>
                  <input
                    type="number"
                    value={input.monthlyAddition}
                    onChange={e => setInput({...input, monthlyAddition: +e.target.value})}
                    className="w-full pl-7 pr-3 py-2.5 border border-[var(--shell-border)] bg-[var(--shell-surface)] rounded-lg text-sm text-[var(--shell-text)] focus:outline-none focus:border-cyan-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--shell-text-muted)] mb-1 block">Investment Horizon: {input.years} years</label>
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={input.years}
                  onChange={e => setInput({...input, years: +e.target.value})}
                  className="w-full accent-cyan-500"
                />
                <div className="flex justify-between text-xs text-[var(--shell-text-faint)] mt-1">
                  <span>1 yr</span><span>30 yrs</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--shell-text-muted)] mb-1 block">Expected Annual Return: {input.expectedReturn}%</label>
                <input
                  type="range"
                  min={6}
                  max={24}
                  step={0.5}
                  value={input.expectedReturn}
                  onChange={e => setInput({...input, expectedReturn: +e.target.value})}
                  className="w-full accent-cyan-500"
                />
                <div className="flex justify-between text-xs text-[var(--shell-text-faint)] mt-1">
                  <span>6%</span><span>24%</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--shell-text-muted)] mb-1 block">Market Condition</label>
                <select
                  value={input.marketCondition}
                  onChange={e => setInput({...input, marketCondition: e.target.value as any})}
                  className="w-full px-3 py-2.5 border border-[var(--shell-border)] bg-[var(--shell-surface)] rounded-lg text-sm text-[var(--shell-text)] focus:outline-none focus:border-cyan-500/40"
                >
                  <option value="bull">Bull Market</option>
                  <option value="bear">Bear Market</option>
                  <option value="sideways">Sideways</option>
                  <option value="volatile">Volatile</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--shell-text-muted)] mb-1 block">Alpha Trigger: {input.triggerPercent}%</label>
                <input
                  type="range"
                  min={5}
                  max={30}
                  value={input.triggerPercent}
                  onChange={e => setInput({...input, triggerPercent: +e.target.value})}
                  className="w-full accent-cyan-500"
                />
              </div>

              <div className="pt-2 border-t border-[var(--shell-border)]">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-[var(--shell-text-muted)]">Fund Mix</label>
                  <span className={`text-xs font-semibold ${
                    Math.abs(input.funds.reduce((s, f) => s + f.allocation, 0) - 100) < 0.5
                      ? "text-emerald-500"
                      : "text-amber-500"
                  }`}>
                    {input.funds.reduce((s, f) => s + f.allocation, 0).toFixed(0)}% allocated
                  </span>
                </div>
                <div className="space-y-3">
                  {input.funds.map((fund, idx) => (
                    <div key={fund.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[var(--shell-text-muted)] font-medium">{fund.name}</span>
                        <span className="text-xs text-[var(--shell-text-faint)]">
                          {fund.allocation}% · {fund.expectedReturn}% exp.
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={70}
                        value={fund.allocation}
                        onChange={(e) => {
                          const updated = [...input.funds];
                          updated[idx] = { ...fund, allocation: +e.target.value };
                          setInput({ ...input, funds: updated });
                        }}
                        className="w-full accent-cyan-500 h-1.5"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-[var(--shell-text-faint)] mt-2 leading-relaxed">
                  Allocations are normalized automatically when the simulation runs.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="text-sm font-medium text-[var(--shell-text)]">Enable QRP Rebalancing</p>
                  <p className="text-xs text-[var(--shell-text-faint)]">Apply QuantRebalance Protocol</p>
                </div>
                <button
                  onClick={() => setInput({...input, enableRebalancing: !input.enableRebalancing})}
                  className={`relative w-11 h-6 rounded-full transition-colors ${input.enableRebalancing ? "bg-cyan-500" : "bg-[var(--shell-surface-2)]"}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${input.enableRebalancing ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            </div>

            <button
              onClick={handleRun}
              disabled={running}
              className="mt-5 w-full flex items-center justify-center gap-2 py-3 bg-cyan-400 text-slate-950 text-sm font-semibold rounded-xl hover:bg-cyan-300 disabled:opacity-50 transition-colors"
            >
              {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {running ? "Simulating..." : "Run Simulation"}
            </button>

            <p className="text-xs text-[var(--shell-text-faint)] text-center mt-3 leading-relaxed">
              Simulation uses stochastic modeling. Results are illustrative only, not a guarantee of returns.
            </p>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-5">
          {result ? (
            <>
              {/* Key results */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Final Value", value: formatCurrency(result.finalValue, true), icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/15" },
                  { label: "Total Returns", value: formatPercent(result.totalReturnsPercent), icon: BarChart2, color: "text-cyan-500", bg: "bg-cyan-400/15" },
                  { label: "Alpha Generated", value: formatCurrency(result.alphaGenerated, true), icon: Zap, color: "text-violet-500", bg: "bg-violet-500/15" },
                  { label: "Sharpe Ratio", value: result.sharpeRatio.toFixed(2), icon: Shield, color: "text-amber-500", bg: "bg-amber-500/15" },
                ].map(m => (
                  <div key={m.label} className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-xl p-4">
                    <div className={`w-8 h-8 ${m.bg} rounded-lg flex items-center justify-center mb-2`}>
                      <m.icon className={`w-4 h-4 ${m.color}`} strokeWidth={1.5} />
                    </div>
                    <p className="text-xs text-[var(--shell-text-faint)] mb-0.5">{m.label}</p>
                    <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-xl p-6">
                <h2 className="text-sm font-semibold text-[var(--shell-text)] mb-4">Portfolio Growth Simulation</h2>
                <SimulatorChart months={result.months} />
              </div>

              {/* Comparison */}
              <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-xl p-6">
                <h2 className="text-sm font-semibold text-[var(--shell-text)] mb-4">With vs Without Rebalancing</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <p className="text-xs font-medium text-emerald-500 mb-1">With QRP Rebalancing</p>
                    <p className="text-2xl font-bold text-emerald-500">{formatCurrency(result.comparison.withRebalancing, true)}</p>
                    <p className="text-xs text-emerald-500/80 mt-1">{result.rebalanceCount} rebalance events</p>
                  </div>
                  <div className="p-4 bg-[var(--shell-surface-2)] border border-[var(--shell-border)] rounded-xl">
                    <p className="text-xs font-medium text-[var(--shell-text-muted)] mb-1">Without Rebalancing</p>
                    <p className="text-2xl font-bold text-[var(--shell-text-muted)]">{formatCurrency(result.comparison.withoutRebalancing, true)}</p>
                    <p className="text-xs text-[var(--shell-text-faint)] mt-1">Buy and hold</p>
                  </div>
                </div>
                {result.comparison.difference > 0 && (
                  <div className="mt-3 p-3 bg-cyan-400/10 border border-cyan-500/20 rounded-lg text-sm text-cyan-500">
                    QRP Rebalancing generated{" "}
                    <span className="font-semibold">{formatCurrency(result.comparison.difference, true)}</span>{" "}
                    more ({formatPercent(result.comparison.differencePercent)}) vs buy-and-hold strategy.
                  </div>
                )}
              </div>

              {/* Fund breakdown */}
              {result.fundBreakdown.length > 0 && (
                <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-xl p-6">
                  <h2 className="text-sm font-semibold text-[var(--shell-text)] mb-4 flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-[var(--shell-text-muted)]" />
                    Fund Mix Breakdown
                  </h2>
                  <div className="space-y-3">
                    {result.fundBreakdown.map((f) => (
                      <div key={f.name} className="flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-[var(--shell-text)] truncate">{f.name}</span>
                            <span className="text-xs text-[var(--shell-text-faint)]">{categoryLabel(f.category)}</span>
                          </div>
                          <div className="h-1.5 bg-[var(--shell-surface-2)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-cyan-500 rounded-full"
                              style={{ width: `${f.allocationPercent}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-right shrink-0 w-28">
                          <p className="text-sm font-semibold text-[var(--shell-text)]">
                            {formatCurrency(f.finalValue, true)}
                          </p>
                          <p className="text-xs text-[var(--shell-text-faint)]">{f.allocationPercent}% allocation</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-[var(--shell-text-faint)] mt-4 leading-relaxed">
                    Contribution is modeled from each fund&apos;s expected return relative to the blended
                    portfolio outcome — illustrative, not a precise per-fund forecast.
                  </p>
                </div>
              )}

              {/* Stats */}
              <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-xl p-6">
                <h2 className="text-sm font-semibold text-[var(--shell-text)] mb-4">Simulation Statistics</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    { label: "Total Invested", value: formatCurrency(result.totalInvested, true) },
                    { label: "Max Drawdown", value: `${result.maxDrawdown.toFixed(1)}%` },
                    { label: "Alpha Captured", value: formatCurrency(result.alphaGenerated, true) },
                    { label: "Rebalance Events", value: result.rebalanceCount.toString() },
                    { label: "Sharpe Ratio", value: result.sharpeRatio.toFixed(2) },
                    { label: "Net Returns", value: formatCurrency(result.totalReturns, true) },
                  ].map(s => (
                    <div key={s.label}>
                      <p className="text-xs text-[var(--shell-text-faint)]">{s.label}</p>
                      <p className="font-semibold text-[var(--shell-text)] mt-0.5">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-xl">
              <BarChart2 className="w-10 h-10 text-[var(--shell-text-faint)] mb-3" />
              <p className="text-sm text-[var(--shell-text-faint)] font-medium">Configure and run your simulation</p>
              <p className="text-xs text-[var(--shell-text-faint)] mt-1">Adjust parameters on the left, then click Run</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
