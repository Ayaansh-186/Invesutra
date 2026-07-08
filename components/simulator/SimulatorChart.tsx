"use client";

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Scatter,
} from "recharts";
import type { SimulationMonth } from "@/lib/types";

interface Props {
  months: SimulationMonth[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-xl p-3 shadow-lg text-xs min-w-[160px]">
        <p className="text-[var(--shell-text-faint)] mb-2 font-medium">{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex justify-between gap-4 mb-1">
            <span style={{ color: p.color }}>{p.name}</span>
            <span className="font-semibold text-[var(--shell-text)]">
              ₹{(p.value / 100000).toFixed(2)}L
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function SimulatorChart({ months }: Props) {
  // Sample every 3 months to reduce data points for performance
  const data = months
    .filter((_, i) => i % 3 === 0 || months[i]?.rebalanced)
    .map((m) => ({
      month: m.date,
      "Portfolio Value": m.portfolioValue,
      "Total Invested": m.invested,
      rebalanced: m.rebalanced ? m.portfolioValue : null,
    }));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.12} />
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            interval={Math.floor(data.length / 6)}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`}
            width={55}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }}
          />
          <Area
            type="monotone"
            dataKey="Portfolio Value"
            stroke="#0ea5e9"
            strokeWidth={2}
            fill="url(#portfolioGrad)"
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="Total Invested"
            stroke="#94a3b8"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
          />
          <Scatter
            dataKey="rebalanced"
            fill="#f59e0b"
            name="Rebalance Event"
            shape={(props: any) => {
              if (!props.rebalanced) return null;
              return (
                <circle
                  cx={props.cx}
                  cy={props.cy}
                  r={4}
                  fill="#f59e0b"
                  stroke="#fff"
                  strokeWidth={1.5}
                />
              );
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
