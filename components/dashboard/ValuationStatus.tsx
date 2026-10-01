import type { Portfolio } from "@/lib/types";
import { AlertTriangle, ShieldCheck, Loader2 } from "lucide-react";

export default function ValuationStatus({ portfolio }: { portfolio: Portfolio }) {
  if (!portfolio.funds.length || portfolio.valuationComplete === undefined) return null;
  if (portfolio.valuationPending) return <div role="status" className="mb-5 flex items-center gap-2.5 border-l-2 border-cyan-400 py-1 pl-3 text-xs text-[var(--shell-text-muted)]">
    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
    Checking published NAVs and purchase records...
  </div>;
  const unpriced = portfolio.funds.filter((fund) => fund.valuationStatus !== "verified").length;
  const uncheckedPurchases = portfolio.funds.filter((fund) => fund.purchaseStatus !== "verified").length;
  const checked = portfolio.valuationCheckedAt ? new Date(portfolio.valuationCheckedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  const needsReview = unpriced > 0 || uncheckedPurchases > 0;
  const Icon = needsReview ? AlertTriangle : ShieldCheck;
  return <div role="status" className={`mb-5 flex items-start gap-2.5 border-l-2 py-1 pl-3 text-xs leading-relaxed ${needsReview ? "border-amber-400 text-amber-700 dark:text-amber-400" : "border-emerald-400 text-[var(--shell-text-muted)]"}`}>
    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
    <div className="min-w-0">
      <p className="font-medium">{needsReview ? "Some holdings need verification" : "NAV valuations verified"}</p>
      {needsReview && <p className="mt-0.5">{unpriced > 0 && `${unpriced} NAV valuation${unpriced === 1 ? "" : "s"} unavailable. `}{uncheckedPurchases > 0 && `${uncheckedPurchases} purchase record${uncheckedPurchases === 1 ? "" : "s"} unverified.`} Returns and allocation actions are paused.</p>}
      {checked && <p className="mt-1 text-[var(--shell-text-faint)]">Checked {checked} IST</p>}
    </div>
  </div>;
}
