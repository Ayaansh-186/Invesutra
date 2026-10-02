import type { Portfolio, SimFund } from "@/lib/types";
import { isPortfolioDataReady, hasVerifiedValue } from "@/lib/marketData/quality";

export function portfolioSimulationInputs(portfolio: Portfolio, assumedReturn: number): { initialInvestment: number; funds: SimFund[] } | null {
  if (!isPortfolioDataReady(portfolio) || !portfolio.funds.length || !portfolio.funds.every(fund =>
      hasVerifiedValue(fund) && (fund.purchaseStatus === undefined || fund.purchaseStatus === "verified") &&
      Number.isFinite(fund.currentValue) && fund.currentValue > 0 && Number.isFinite(fund.units) && fund.units > 0) ||
      !Number.isFinite(assumedReturn) || assumedReturn <= -100 || assumedReturn > 100) return null;
  const total = portfolio.funds.reduce((sum, fund) => sum + fund.currentValue, 0);
  if (!Number.isFinite(total) || total <= 0) return null;
  return {
    initialInvestment: Math.round(total),
    funds: portfolio.funds.map((fund) => ({ name: fund.name, allocation: fund.currentValue / total * 100,
      expectedReturn: assumedReturn, category: fund.category, riskLevel: fund.riskLevel })),
  };
}
