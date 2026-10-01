import type { Fund, Portfolio } from "@/lib/types";
import type { FundDetails } from "./types";
import { getFundDetails, searchFunds } from "./providers";
import { findExactLiveFund } from "./matchFund";
import { isRecentNav } from "./navFreshness";
import { isExchangeTradedFund } from "./amfi";
import { getPurchaseQuote } from "./purchaseQuote";
import { roundMoney } from "@/lib/utils/purchase";
import { recalculatePortfolio } from "@/lib/supabase/mappers";

export function applyVerifiedNav(fund: Fund, detail?: FundDetails, now = new Date()): Fund {
  const base: Fund = { ...fund, verifiedMetrics: [], valuationCheckedAt: now.toISOString() };
  if (isExchangeTradedFund(fund.name) || (detail && isExchangeTradedFund(detail.name))) return { ...base, valuationStatus: "unsupported" };
  if (!Number.isFinite(fund.units) || fund.units <= 0) return { ...base, valuationStatus: "missing_units" };
  if (!detail) return { ...base, valuationStatus: fund.schemeCode ? "unavailable" : "missing_scheme" };
  if (fund.schemeCode && fund.schemeCode !== String(detail.schemeCode)) return { ...base, valuationStatus: "unavailable" };
  const meta = { schemeCode: String(detail.schemeCode), navAsOf: detail.navAsOf, navSourceUrl: detail.sourceUrl, nav: Number.isFinite(detail.nav) && detail.nav! > 0 ? detail.nav! : fund.nav };
  if (!isRecentNav(detail.navAsOf, now)) return { ...base, ...meta, valuationStatus: "stale" };
  if (!detail.nav || !Number.isFinite(detail.nav) || detail.nav <= 0) return { ...base, ...meta, valuationStatus: "unavailable" };
  if (!Number.isFinite(fund.units * detail.nav)) return { ...base, ...meta, valuationStatus: "unavailable" };
  const verifiedMetrics: NonNullable<Fund["verifiedMetrics"]> = [];
  for (const key of ["returns1Y", "returns3Y", "returns5Y"] as const) {
    if (Number.isFinite(detail[key])) verifiedMetrics.push(key);
  }
  return {
    ...base, ...meta, name: detail.name, category: detail.category, riskLevel: detail.riskLevel,
    nav: detail.nav, currentValue: roundMoney(fund.units * detail.nav), valuationStatus: "verified",
    returns1Y: detail.returns1Y ?? 0, returns3Y: detail.returns3Y ?? 0, returns5Y: detail.returns5Y ?? 0,
    verifiedMetrics,
  };
}

async function verifyHolding(fund: Fund): Promise<Fund> {
  if (isExchangeTradedFund(fund.name) || !(fund.units > 0)) return applyVerifiedNav(fund);
  try {
    let code = fund.schemeCode;
    if (!code) code = findExactLiveFund(fund.name, await searchFunds(fund.name))?.symbol;
    if (!code) return applyVerifiedNav(fund);
    const detail = await getFundDetails(code);
    const valued = applyVerifiedNav(fund, detail);
    if (!fund.purchaseDate || !fund.purchaseNav) return { ...valued, purchaseStatus: "unavailable" };
    try {
      const quote = await getPurchaseQuote(detail, fund.purchaseDate);
      const matches = quote && Math.abs(quote.nav - fund.purchaseNav) <= Math.max(0.001, quote.nav * 0.0001) &&
        Math.abs(roundMoney(quote.nav * fund.units) - fund.investedAmount) <= 0.02;
      return { ...valued, purchaseStatus: matches ? "verified" : "unverified" };
    } catch { return { ...valued, purchaseStatus: "unavailable" }; }
  } catch { return { ...applyVerifiedNav(fund), purchaseStatus: "unavailable" }; }
}

export async function hydrateFundValuations(holdings: Fund[]): Promise<Fund[]> {
  const funds: Fund[] = [];
  for (let index = 0; index < holdings.length; index += 6) {
    funds.push(...await Promise.all(holdings.slice(index, index + 6).map(verifyHolding)));
  }
  return funds;
}

export async function hydratePortfolioValuations(portfolio: Portfolio): Promise<Portfolio> {
  const funds = await hydrateFundValuations(portfolio.funds);
  return recalculatePortfolio({
    ...portfolio, funds,
    valuationPending: false,
    valuationComplete: funds.every((fund) => fund.valuationStatus === "verified"),
    purchaseComplete: funds.every((fund) => fund.purchaseStatus === "verified"),
    valuationCheckedAt: new Date().toISOString(),
  });
}
