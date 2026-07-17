// Copyright © 2026 Ayaansh Singhal. All Rights Reserved.
//
// Real mutual fund data source for the Mutual Fund MCP server.
//
// IMPORTANT — why this isn't "Zerodha data": Zerodha's own Kite Connect /
// Kite MCP API (https://github.com/zerodha/kite-mcp-server) does not expose
// a mutual fund screener (no NAV database, no returns, no expense ratio, no
// risk rating, no category search). It only exposes market quotes and a
// *logged-in user's own* holdings via personal Zerodha OAuth. None of that
// fits an anonymous "search mutual funds" chat feature.
//
// So fund search/NAV/returns/category here are sourced from AMFI (the
// official Association of Mutual Funds in India NAV registry) via
// api.mfapi.in — a free, keyless, public JSON mirror of AMFI's daily NAV
// file (https://www.amfiindia.com/spages/NAVAll.txt). No credentials, no
// paid tier. Expense ratio and AUM are NOT published in this feed by any
// free source, so we intentionally return `undefined` for those fields
// instead of inventing numbers — the UI/AI should say "not available"
// rather than show a fabricated figure.

import type { FundCategory, RiskLevel } from "@/lib/types";

const MFAPI_BASE = process.env.MFAPI_BASE_URL || "https://api.mfapi.in";

export interface MfApiSearchHit {
  schemeCode: number;
  schemeName: string;
}

export interface MfApiNavPoint {
  date: string; // dd-mm-yyyy
  nav: string;
}

export interface MfApiSchemeDetail {
  meta: {
    fund_house: string;
    scheme_type: string;
    scheme_category: string;
    scheme_code: number;
    scheme_name: string;
    isin_growth?: string | null;
    isin_div_reinvestment?: string | null;
  };
  data: MfApiNavPoint[];
}

// Small in-memory cache. Serverless instances are short-lived, but this
// still saves repeated upstream calls across tool calls within one warm
// invocation (e.g. search then get-details in the same chat turn).
const CACHE_TTL_MS = 15 * 60 * 1000;
const FETCH_TIMEOUT_MS = 6_000;
const cache = new Map<string, { at: number; value: unknown }>();

async function cachedFetchJson<T>(url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.value as T;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
  } catch (error) {
    throw new Error(`mfapi.in request failed for ${url}: ${error instanceof Error ? error.message : "network error"}`);
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    throw new Error(`mfapi.in request failed (${res.status}) for ${url}`);
  }
  const json = (await res.json()) as T;
  cache.set(url, { at: Date.now(), value: json });
  return json;
}

export function isMutualFundSourceConfigured(): boolean {
  // No key required — always "configured". Kept as a function so a future
  // paid/alternate provider can be swapped in behind the same check.
  return true;
}

export async function searchSchemes(query: string, limit = 10): Promise<MfApiSearchHit[]> {
  const url = `${MFAPI_BASE}/mf/search?q=${encodeURIComponent(query)}`;
  const results = await cachedFetchJson<MfApiSearchHit[]>(url);
  return (results || []).slice(0, limit);
}

export async function getSchemeDetail(schemeCode: number | string): Promise<MfApiSchemeDetail> {
  const url = `${MFAPI_BASE}/mf/${schemeCode}`;
  return cachedFetchJson<MfApiSchemeDetail>(url);
}

function parseDdMmYyyy(date: string): number {
  const [dd, mm, yyyy] = date.split("-").map(Number);
  return new Date(yyyy, (mm || 1) - 1, dd || 1).getTime();
}

/**
 * Computes trailing point-to-point returns from historical NAV data.
 * mfapi.in returns `data` newest-first. 1Y/3Y returns are annualized
 * (CAGR); if there isn't enough history for a horizon, that field is
 * omitted rather than guessed.
 */
export function computeReturns(data: MfApiNavPoint[]): {
  returns1Y?: number;
  returns3Y?: number;
  returns5Y?: number;
  latestNav?: number;
  asOf?: string;
} {
  if (!data || data.length === 0) return {};

  const sorted = [...data].sort((a, b) => parseDdMmYyyy(b.date) - parseDdMmYyyy(a.date));
  const latest = sorted[0];
  const latestNav = Number(latest.nav);
  const latestTime = parseDdMmYyyy(latest.date);

  function navApproxYearsAgo(years: number): number | undefined {
    const targetTime = latestTime - years * 365.25 * 24 * 60 * 60 * 1000;
    // Find the closest data point to the target date (within ~10 days).
    let closest: MfApiNavPoint | undefined;
    let closestDiff = Infinity;
    for (const point of sorted) {
      const diff = Math.abs(parseDdMmYyyy(point.date) - targetTime);
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = point;
      }
    }
    if (!closest || closestDiff > 10 * 24 * 60 * 60 * 1000) return undefined;
    return Number(closest.nav);
  }

  function cagr(years: number): number | undefined {
    const past = navApproxYearsAgo(years);
    if (!past || past <= 0 || !latestNav) return undefined;
    return Number(((Math.pow(latestNav / past, 1 / years) - 1) * 100).toFixed(2));
  }

  return {
    latestNav,
    asOf: latest.date,
    returns1Y: cagr(1),
    returns3Y: cagr(3),
    returns5Y: cagr(5),
  };
}

/**
 * Maps AMFI's free-text `scheme_category` (e.g. "Equity Scheme - Flexi Cap
 * Fund") to Invesutra's internal FundCategory enum. Best-effort keyword
 * match — AMFI doesn't publish a machine-friendly category code.
 */
export function mapAmfiCategory(schemeCategory: string, schemeName: string): FundCategory {
  const s = `${schemeCategory} ${schemeName}`.toLowerCase();
  if (s.includes("elss") || s.includes("tax saving")) return "elss";
  if (s.includes("index") || s.includes("etf")) return "index";
  if (s.includes("sectoral") || s.includes("thematic")) return "sectoral";
  if (s.includes("international") || s.includes("overseas") || s.includes("global") || s.includes("us equity"))
    return "international";
  if (s.includes("hybrid") || s.includes("balanced")) return "hybrid";
  if (s.includes("debt") || s.includes("gilt") || s.includes("liquid") || s.includes("bond") || s.includes("income"))
    return "debt";
  if (s.includes("small cap")) return "small_cap";
  if (s.includes("mid cap")) return "mid_cap";
  if (s.includes("multi cap")) return "multi_cap";
  if (s.includes("flexi cap")) return "flexi_cap";
  return "large_cap";
}

/**
 * Approximate SEBI-riskometer-style risk band inferred from category. This
 * is a heuristic (not fetched live data) since AMFI/mfapi.in don't publish
 * per-scheme riskometer values in the free feed. Documented as such
 * wherever it's surfaced to the user/AI.
 */
export function inferRiskLevel(category: FundCategory): RiskLevel {
  switch (category) {
    case "debt":
      return "low";
    case "hybrid":
    case "index":
      return "moderate";
    case "large_cap":
    case "multi_cap":
    case "flexi_cap":
      return "moderately_high";
    case "mid_cap":
    case "elss":
    case "international":
      return "high";
    case "small_cap":
    case "sectoral":
      return "very_high";
    default:
      return "moderate";
  }
}
