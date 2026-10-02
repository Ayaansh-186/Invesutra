import type { Portfolio } from "@/lib/types";
import { navDateToIso } from "./navFreshness";

export function valuationSummary(portfolio: Portfolio) {
  const priced = portfolio.funds.filter(fund => fund.valuationStatus === "verified" && Number.isFinite(fund.currentValue) && fund.currentValue > 0);
  const dates = priced.map(fund => navDateToIso(fund.navAsOf)).filter((date): date is string => Boolean(date)).sort();
  return {
    verifiedCount: priced.length,
    totalCount: portfolio.funds.length,
    verifiedValue: priced.reduce((sum, fund) => sum + fund.currentValue, 0),
    oldestNavDate: dates[0],
    latestNavDate: dates.at(-1),
  };
}
