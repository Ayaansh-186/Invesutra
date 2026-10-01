import { computeReturns, getSchemeDetail, searchSchemes } from "@/lib/mcp/mutualFundSource";
import type { MfApiSearchHit } from "@/lib/mcp/mutualFundSource";
import { isRecentNav } from "./navFreshness";

export type RankingPeriod = "1Y" | "3Y" | "5Y";

export interface RankedFund {
  schemeCode: number;
  name: string;
  category: string;
  nav: number;
  navAsOf: string;
  returns1Y?: number;
  returns3Y?: number;
  returns5Y?: number;
}

// A transparent comparison universe, not the entire Indian mutual-fund market.
export const SHORTLIST_QUERIES = [
  "HDFC Flexi Cap Fund", "Parag Parikh Flexi Cap Fund", "Nippon India Small Cap Fund",
  "SBI Small Cap Fund", "UTI Nifty 50 Index Fund", "ICICI Prudential Large Cap Fund",
  "Kotak Midcap Fund", "Motilal Oswal Midcap Fund", "Axis Midcap Fund",
  "Mirae Asset Large Cap Fund", "HDFC Mid Cap Fund", "Canara Robeco Large Cap Fund",
  "Quant Small Cap Fund", "DSP Midcap Fund", "Tata Digital India Fund",
  "ICICI Prudential Equity and Debt Fund", "HDFC Balanced Advantage Fund", "Nippon India Growth Mid Cap Fund",
];

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function selectDirectGrowthScheme(query: string, hits: MfApiSearchHit[]): MfApiSearchHit | undefined {
  const target = normalizeName(query);
  return hits.find((candidate) => {
    const name = candidate.schemeName;
    if (!/\bdirect\b/i.test(name) || !/\bgrowth\b/i.test(name) || /\bETF\b|\bidcw\b|dividend/i.test(name)) return false;
    return normalizeName(name.split(/\bdirect\b/i)[0]) === target;
  });
}

export function rankFunds(funds: RankedFund[], period: RankingPeriod, now = new Date()): RankedFund[] {
  const key = period === "1Y" ? "returns1Y" : period === "3Y" ? "returns3Y" : "returns5Y";
  return funds.filter((fund) => Number.isFinite(fund[key]) && Number.isFinite(fund.nav) && fund.nav > 0 && isRecentNav(fund.navAsOf, now))
    .sort((a, b) => (b[key] ?? -Infinity) - (a[key] ?? -Infinity)).slice(0, 10);
}

export async function loadShortlist(): Promise<RankedFund[]> {
  const results = await Promise.allSettled(SHORTLIST_QUERIES.map(async (query) => {
    const hits = await searchSchemes(query, 100);
    const hit = selectDirectGrowthScheme(query, hits);
    if (!hit) return null;
    const detail = await getSchemeDetail(hit.schemeCode);
    if (detail.meta.scheme_code !== hit.schemeCode) return null;
    const values = computeReturns(detail.data);
    if (!values.latestNav || !isRecentNav(values.asOf)) return null;
    return {
      schemeCode: hit.schemeCode,
      name: detail.meta.scheme_name,
      category: detail.meta.scheme_category,
      nav: values.latestNav,
      navAsOf: values.asOf!,
      returns1Y: values.returns1Y,
      returns3Y: values.returns3Y,
      returns5Y: values.returns5Y,
    } satisfies RankedFund;
  }));
  const unique = new Map<number, RankedFund>();
  for (const result of results) {
    if (result.status === "fulfilled" && result.value) unique.set(result.value.schemeCode, result.value);
  }
  return [...unique.values()];
}
