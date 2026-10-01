import type { Fund, Portfolio } from "@/lib/types";

export function hasVerifiedValue(fund: Fund): boolean {
  return fund.valuationStatus === undefined || fund.valuationStatus === "verified";
}

export function hasVerifiedMetric(fund: Fund, metric: NonNullable<Fund["verifiedMetrics"]>[number]): boolean {
  return fund.verifiedMetrics === undefined || fund.verifiedMetrics.includes(metric);
}

export function isPortfolioDataReady(portfolio: Portfolio): boolean {
  return portfolio.valuationComplete !== false && portfolio.purchaseComplete !== false;
}
