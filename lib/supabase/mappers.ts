import type { DbFund, DbPortfolio, DbTransaction } from "@/lib/supabase/database.types";
import type { Fund, FundCategory, Portfolio, RiskLevel } from "@/lib/types";
import { riskEngine } from "@/lib/algorithm/riskEngine";
import { parseMonthlySipAmount } from "@/lib/utils/monthlySip";

export type DbPurchase = Pick<DbTransaction, "fund_id" | "created_at" | "nav"> & Partial<Pick<DbTransaction, "notes" | "id" | "amount" | "units">>;

export function dbFundToFund(row: DbFund, input?: DbPurchase | DbPurchase[]): Fund {
  const records = (Array.isArray(input) ? input : input ? [input] : []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
  const purchase = records[0];
  const codes = new Set(records.map(item => /^AMFI scheme (\d+)$/.exec(item.notes || "")?.[1]));
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
    purchaseDate: purchase?.created_at.slice(0, 10),
    purchaseNav: records.length === 1 && purchase?.nav != null ? Number(purchase.nav) : undefined,
    ...(records.length && records.every(item => item.id !== undefined && item.units !== undefined && item.amount !== undefined) ? { purchases: records.map(item => ({
      id: item.id!, date: item.created_at.slice(0, 10), nav: Number(item.nav), units: Number(item.units), amount: Number(item.amount),
    })) } : {}),
    monthlySipAmount: row.monthly_sip_amount == null ? undefined : parseMonthlySipAmount(Number(row.monthly_sip_amount)) ?? undefined,
    schemeCode: codes.size === 1 ? codes.values().next().value : undefined,
    createdAt: row.created_at,
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
    ...(fund.monthlySipAmount !== undefined ? { monthly_sip_amount: fund.monthlySipAmount } : {}),
  };
}

/**
 * Builds a full Portfolio domain object (with computed health/risk scores)
 * from a portfolio row and its fund rows. Centralizes the same scoring
 * logic used everywhere else so dashboard/screener/reports stay consistent
 * regardless of where the portfolio data originated.
 */
export function buildPortfolio(portfolioRow: DbPortfolio, fundRows: DbFund[], purchases: DbPurchase[] = []): Portfolio {
  const purchasesByFund = new Map<string, DbPurchase[]>();
  for (const purchase of purchases) {
    purchasesByFund.set(purchase.fund_id, [...(purchasesByFund.get(purchase.fund_id) || []), purchase]);
  }
  const funds = fundRows.map((row) => dbFundToFund(row, purchasesByFund.get(row.id)));
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

  return recalculatePortfolio(basePortfolio);
}

export function recalculatePortfolio(portfolio: Portfolio): Portfolio {
  const totalInvested = portfolio.funds.reduce((sum, fund) => sum + fund.investedAmount, 0);
  const currentValue = portfolio.funds.reduce((sum, fund) => sum + fund.currentValue, 0);
  const basePortfolio = {
    ...portfolio, totalInvested, currentValue, returns: currentValue - totalInvested,
    returnsPercent: totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0,
  };
  // Run the same deterministic engine used elsewhere to derive health/risk
  // scores so a freshly-loaded portfolio from the DB looks identical to one
  // computed from mock data.
  const analysis = riskEngine.analyzePortfolio(basePortfolio);

  return {
    ...basePortfolio,
    healthScore: analysis.healthScore,
    riskScore: analysis.riskScore,
    analysis,
  };
}
