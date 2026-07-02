export function formatCurrency(value: number, compact = false): string {
  if (compact) {
    if (Math.abs(value) >= 10000000) return `Rs ${(value / 10000000).toFixed(2)}Cr`;
    if (Math.abs(value) >= 100000) return `Rs ${(value / 100000).toFixed(2)}L`;
    if (Math.abs(value) >= 1000) return `Rs ${(value / 1000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number, showSign = true): string {
  const sign = showSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function getRiskColor(risk: string): string {
  const map: Record<string, string> = {
    low: "text-emerald-500",
    moderate: "text-blue-500",
    moderately_high: "text-amber-500",
    high: "text-orange-500",
    very_high: "text-red-500",
  };
  return map[risk] || "text-slate-500";
}

export function getRiskBg(risk: string): string {
  const map: Record<string, string> = {
    low: "bg-emerald-50 text-emerald-700 border-emerald-200",
    moderate: "bg-blue-50 text-blue-700 border-blue-200",
    moderately_high: "bg-amber-50 text-amber-700 border-amber-200",
    high: "bg-orange-50 text-orange-700 border-orange-200",
    very_high: "bg-red-50 text-red-700 border-red-200",
  };
  return map[risk] || "bg-slate-50 text-slate-700 border-slate-200";
}

export function getHealthColor(score: number): string {
  if (score >= 80) return "text-emerald-500";
  if (score >= 60) return "text-blue-500";
  if (score >= 40) return "text-amber-500";
  return "text-red-500";
}

export function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    large_cap: "Large Cap",
    mid_cap: "Mid Cap",
    small_cap: "Small Cap",
    multi_cap: "Multi Cap",
    flexi_cap: "Flexi Cap",
    debt: "Debt",
    hybrid: "Hybrid",
    index: "Index",
    sectoral: "Sectoral",
    elss: "ELSS",
    international: "International",
  };
  return map[cat] || cat;
}
