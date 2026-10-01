import type { Portfolio } from "@/lib/types";
import { isExchangeTradedFund } from "./amfi";

/** Saved holdings can render immediately, but saved prices are not current quotes. */
export function preparePendingPortfolio(portfolio: Portfolio): Portfolio {
  return {
    ...portfolio,
    funds: portfolio.funds.map((fund) => ({
      ...fund,
      valuationStatus: isExchangeTradedFund(fund.name) ? "unsupported" :
        !Number.isFinite(fund.units) || fund.units <= 0 ? "missing_units" : "pending",
      purchaseStatus: "unavailable",
      verifiedMetrics: [],
      navAsOf: undefined,
      navSourceUrl: undefined,
      valuationCheckedAt: undefined,
    })),
    valuationPending: portfolio.funds.length > 0,
    valuationComplete: portfolio.funds.length === 0,
    purchaseComplete: portfolio.funds.length === 0,
    valuationCheckedAt: undefined,
    currentValue: 0,
    returns: 0,
    returnsPercent: 0,
    healthScore: 0,
    riskScore: 0,
    analysis: undefined,
  };
}

export function markVerificationUnavailable(portfolio: Portfolio): Portfolio {
  const pending = preparePendingPortfolio(portfolio);
  return {
    ...pending,
    valuationPending: false,
    funds: pending.funds.map((fund) => fund.valuationStatus === "pending"
      ? { ...fund, valuationStatus: "unavailable" } : fund),
  };
}
