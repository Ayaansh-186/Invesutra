import type { DbFund, DbPortfolio } from "@/lib/supabase/database.types";
import type { Fund, FundCategory, Portfolio, RiskLevel } from "@/lib/types";
import { riskEngine } from "@/lib/algorithm/riskEngine";

export function dbFundToFund(row: DbFund): Fund {
  return {
    id: row.id,
    name: row.name,
    category: row.category as FundCategory,
    investedAmount: Number(row.invested_amount),
    currentValue: Number(row.current_value),
    nav: Number(row.nav),
    units: Number(row.units),
    returns1Y: Number(row.returns_1y),
    returns3Y: Number(row.returns_3y),
    returns5Y: Number(row.returns_5y),
    riskLevel: row.risk_level as RiskLevel,
    expenseRatio: Number(row.expense_ratio),
    aum: Number(row.aum),
    benchmark: row.benchmark || "",
    manager: row.manager || "",
  };
}

export function fundToDbInsert(fund: Partial<Fund>, portfolioId: string) {
  return {
    portfolio_id: portfolioId,
    name: fund.name,
    category: fund.category,
    invested_amount: fund.investedAmount,
    current_value: fund.currentValue,
    nav: fund.nav ?? 0,
    units: fund.units ?? 0,
    returns_1y: fund.returns1Y ?? 0,
    returns_3y: fund.returns3Y ?? 0,
    returns_5y: fund.returns5Y ?? 0,
    risk_level: fund.riskLevel,
    expense_ratio: fund.expenseRatio ?? 0,
    aum: fund.aum ?? 0,
    benchmark: fund.benchmark ?? null,
    manager: fund.manager ?? null,
  };
}

/**
 * Builds a full Portfolio domain object (with computed health/risk scores)
 * from a portfolio row and its fund rows. Centralizes the same scoring
 * logic used everywhere else so dashboard/screener/reports stay consistent
 * regardless of where the portfolio data originated.
 */
export function buildPortfolio(portfolioRow: DbPortfolio, fundRows: DbFund[]): Portfolio {
  const funds = fundRows.map(dbFundToFund);
  const totalInvested = funds.reduce((sum, f) => sum + f.investedAmount, 0);
  const currentValue = funds.reduce((sum, f) => sum + f.currentValue, 0);
  const returns = currentValue - totalInvested;
  const returnsPercent = totalInvested > 0 ? (returns / totalInvested) * 100 : 0;

  const basePortfolio: Portfolio = {
    id: portfolioRow.id,
    userId: portfolioRow.user_id,
    name: portfolioRow.name,
    createdAt: portfolioRow.created_at,
    updatedAt: portfolioRow.updated_at,
    funds,
    totalInvested,
    currentValue,
    returns,
    returnsPercent,
    healthScore: 0,
    riskScore: 0,
  };

  // Run the same deterministic engine used elsewhere to derive health/risk
  // scores so a freshly-loaded portfolio from the DB looks identical to one
  // computed from mock data.
  const analysis = riskEngine.analyzePortfolio(basePortfolio);
  const diversificationWeight = 0.6;
  const riskWeight = 0.4;
  const healthScore = Math.round(
    analysis.diversificationScore * diversificationWeight +
      Math.max(0, 100 - Math.abs(analysis.riskMetrics.beta - 1) * 40) * riskWeight
  );
  const riskScore = Math.min(100, Math.round(analysis.riskMetrics.beta * 50 + analysis.riskMetrics.standardDeviation));

  return {
    ...basePortfolio,
    healthScore: Math.max(0, Math.min(100, healthScore)),
    riskScore: Math.max(0, Math.min(100, riskScore)),
    analysis,
  };
}
