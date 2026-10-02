// Copyright © 2026 Ayaansh Singhal. All Rights Reserved.

import type { FundDataProvider, FundDetails, FundSearchResult, FundSearchFilters, ProviderStatus } from "./types";
import { computeReturns, getSchemeDetail, inferRiskLevel, isMutualFundSourceConfigured, mapAmfiCategory } from "@/lib/mcp/mutualFundSource";
import { isRecentNav, navDateToIso } from "./navFreshness";
import { AMFI_NAV_URL, getAmfiCatalogue, searchAmfiCatalogue } from "./amfi";

function schemeMetadata(name: string) {
  const normalized = name.toLowerCase();
  return {
    planType: (normalized.includes("direct") ? "direct" : normalized.includes("regular") ? "regular" : "unknown") as FundSearchResult["planType"],
    optionType: (normalized.includes("growth") ? "growth" : /\bidcw\b|dividend/.test(normalized) ? "idcw" : "unknown") as FundSearchResult["optionType"],
  };
}

/**
 * Website lookups use the same AMFI/MFAPI source as the MCP tools directly,
 * without creating a tool session for each portfolio holding.
 */
class MutualFundMcpProvider implements FundDataProvider {
  id = "mutual-fund-mcp";
  label = "AMFI NAV catalogue and MFAPI history";

  isConfigured() {
    return isMutualFundSourceConfigured();
  }

  async searchFunds(query: string, filters?: FundSearchFilters): Promise<FundSearchResult[]> {
    const catalogue = await getAmfiCatalogue();
    return searchAmfiCatalogue(catalogue, query, 30, new Date(), filters).map((scheme) => {
      const category = mapAmfiCategory(scheme.category, scheme.name);
      return {
        provider: this.id,
        symbol: scheme.schemeCode,
        name: scheme.name,
        isin: scheme.isin,
        category,
        riskLevel: inferRiskLevel(category),
        nav: scheme.nav,
        asOf: scheme.navAsOf,
        sourceUrl: AMFI_NAV_URL,
        planType: scheme.planType,
        optionType: scheme.optionType,
        dataQuality: "live" as const,
      };
    });
  }

  async getFundDetails(schemeCode: string): Promise<FundDetails> {
    if (!/^\d+$/.test(schemeCode)) throw new Error("Invalid AMFI scheme code");
    const [official, history] = await Promise.allSettled([
      getAmfiCatalogue(), getSchemeDetail(schemeCode),
    ]);
    const scheme = official.status === "fulfilled" ? official.value.find((entry) => entry.schemeCode === schemeCode) : undefined;
    const raw = history.status === "fulfilled" ? history.value : undefined;
    const returns = raw ? computeReturns(raw.data) : {};
    const detail = raw ? {
      schemeCode: raw.meta.scheme_code, name: raw.meta.scheme_name, fundHouse: raw.meta.fund_house,
      category: mapAmfiCategory(raw.meta.scheme_category, raw.meta.scheme_name),
      nav: returns.latestNav, navAsOf: returns.asOf, ...returns, isin: raw.meta.isin_growth || undefined,
    } : null;
    if (detail && String(detail.schemeCode) !== schemeCode) throw new Error("Fund source returned a different scheme");
    if (!scheme && !detail) throw new Error("Published fund data is unavailable");
    const name = scheme?.name || detail!.name;
    const category = scheme ? mapAmfiCategory(scheme.category, scheme.name) : detail!.category;
    const nav = scheme?.nav ?? detail?.nav;
    const navAsOf = scheme?.navAsOf ?? detail?.navAsOf;
    const optionType = scheme?.optionType ?? schemeMetadata(name).optionType;
    const historyMatches = optionType === "growth" && Boolean(detail?.nav && nav &&
      navDateToIso(detail.navAsOf) === navDateToIso(navAsOf) && Math.abs(detail.nav - nav) <= Math.max(0.001, nav * 0.0001) && isRecentNav(navAsOf));
    return {
      schemeCode, name, category, riskLevel: inferRiskLevel(category),
      fundHouse: scheme?.fundHouse || detail?.fundHouse,
      nav, navAsOf, isin: scheme?.isin || detail?.isin,
      returns1Y: historyMatches ? detail?.returns1Y : undefined,
      returns3Y: historyMatches ? detail?.returns3Y : undefined,
      returns5Y: historyMatches ? detail?.returns5Y : undefined,
      optionType, historyAvailable: historyMatches,
      navSource: scheme ? "amfi" : "mfapi",
      sourceUrl: scheme ? AMFI_NAV_URL : `https://api.mfapi.in/mf/${schemeCode}`,
      navCheckedAt: new Date().toISOString(),
    };
  }
}

/**
 * Zerodha's official Kite MCP server (https://github.com/zerodha/kite-mcp-server,
 * hosted at mcp.kite.trade) provides live market quotes and a signed-in
 * user's own holdings/positions — not a fund search/screener API, and every
 * call requires that user's personal Zerodha OAuth session. It's out of
 * scope for an anonymous "search funds" feature; kept here as a documented,
 * honest stub rather than silently pretending to use it for data it can't
 * provide. See README.md "Zerodha Kite MCP (optional, personal accounts)".
 */
class ZerodhaKiteProvider implements FundDataProvider {
  id = "zerodha-kite";
  label = "Zerodha Kite MCP (live quotes, personal account only)";

  isConfigured() {
    return Boolean(process.env.ZERODHA_MCP_SERVER_URL || process.env.KITE_API_KEY);
  }

  async searchFunds(): Promise<FundSearchResult[]> {
    return [];
  }
}

const providers: FundDataProvider[] = [new MutualFundMcpProvider(), new ZerodhaKiteProvider()];

export function getProviderStatuses(): ProviderStatus[] {
  return providers.map((provider) => ({
    id: provider.id,
    label: provider.label,
    configured: provider.isConfigured(),
    notes: provider.isConfigured()
      ? provider.id === "mutual-fund-mcp"
        ? "Official daily AMFI NAV catalogue, with MFAPI historical NAVs. Checked every 15 minutes."
        : "Credentials present."
      : "Not configured.",
  }));
}

export async function searchFunds(query: string, filters?: FundSearchFilters): Promise<FundSearchResult[]> {
  const configuredProviders = providers.filter((provider) => provider.isConfigured());
  const results: FundSearchResult[] = [];
  let providerFailed = false;

  for (const provider of configuredProviders) {
    try {
      results.push(...(await provider.searchFunds(query, filters)));
    } catch (error) {
      providerFailed = true;
      console.warn(`${provider.id} fund search failed:`, error);
    }
  }

  if (providerFailed && results.length === 0) throw new Error("Published fund search is unavailable");

  return results;
}

export async function getFundDetails(schemeCode: string): Promise<FundDetails> {
  const provider = providers.find((p) => p.id === "mutual-fund-mcp") as MutualFundMcpProvider;
  return provider.getFundDetails(schemeCode);
}

// Updating current value does not require downloading or analysing NAV history.
export async function getFundNav(schemeCode: string): Promise<FundDetails> {
  if (!/^\d+$/.test(schemeCode)) throw new Error("Invalid AMFI scheme code");
  try {
    const scheme = (await getAmfiCatalogue()).find(entry => entry.schemeCode === schemeCode);
    if (scheme && isRecentNav(scheme.navAsOf)) {
      const category = mapAmfiCategory(scheme.category, scheme.name);
      return { schemeCode, name: scheme.name, category, riskLevel: inferRiskLevel(category),
        nav: scheme.nav, navAsOf: scheme.navAsOf, navSource: "amfi", sourceUrl: AMFI_NAV_URL,
        navCheckedAt: new Date().toISOString(), optionType: scheme.optionType };
    }
  } catch { /* Exact-scheme history may still provide a recent published NAV. */ }
  return getFundDetails(schemeCode);
}
