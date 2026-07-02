"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function generateChartData(invested: number, currentValue: number) {
  const months = 24;
  const data = [];
  const monthlyGrowth = Math.pow(currentValue / invested, 1 / months);

  for (let i = 0; i <= months; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - (months - i));
    const noise = 1 + (Math.random() - 0.5) * 0.04;
    const value = Math.round(invested * Math.pow(monthlyGrowth, i) * noise);
    data.push({
      month: date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      value,
      invested: Math.round(invested + ((currentValue - invested) / months) * i * 0.3),
    });
  }
  return data;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-lg text-xs">
        <p className="text-slate-500 mb-1">{label}</p>
        <p className="font-semibold text-slate-900">
          ₹{(payload[0].value / 100000).toFixed(2)}L
        </p>
      </div>
    );
  }
  return null;
};

export default function PortfolioChart({ invested, currentValue }: { invested: number; currentValue: number }) {
  const data = generateChartData(invested, currentValue);

  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            interval={3}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`}
            width={55}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#0ea5e9"
            strokeWidth={2}
            fill="url(#colorValue)"
            dot={false}
            activeDot={{ r: 4, fill: "#0ea5e9" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
