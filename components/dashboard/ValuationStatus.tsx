import type { Portfolio } from "@/lib/types";

export default function ValuationStatus({ portfolio }: { portfolio: Portfolio }) {
  if (!portfolio.funds.length || portfolio.valuationComplete === undefined) return null;
  const unpriced = portfolio.funds.filter((fund) => fund.valuationStatus !== "verified").length;
  const uncheckedPurchases = portfolio.funds.filter((fund) => fund.purchaseStatus !== "verified").length;
  const checked = portfolio.valuationCheckedAt ? new Date(portfolio.valuationCheckedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  return <div role="status" className={`my-4 border-l-2 py-1 pl-3 text-xs leading-relaxed ${unpriced || uncheckedPurchases ? "border-amber-400 text-amber-700 dark:text-amber-400" : "border-emerald-400 text-[var(--shell-text-muted)]"}`}>
    {unpriced > 0 ? `${unpriced} holding${unpriced === 1 ? " has" : "s have"} no verified current NAV valuation. ` : "Current NAV valuations verified. "}
    {uncheckedPurchases > 0 && `${uncheckedPurchases} purchase record${uncheckedPurchases === 1 ? " needs" : "s need"} verification before showing returns or allocation actions. `}
    {checked && <span>Checked {checked} IST.</span>}
  </div>;
}
