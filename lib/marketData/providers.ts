// Copyright © 2026 Ayaansh Singhal. All Rights Reserved.

import type { FundCategory, RiskLevel } from "@/lib/types";
import type { FundDataProvider, FundDetails, FundSearchResult, ProviderStatus } from "./types";
import { callMutualFundTool } from "@/lib/mcp/mcpClient";
import { inferRiskLevel, isMutualFundSourceConfigured, mapAmfiCategory } from "@/lib/mcp/mutualFundSource";

interface McpSearchHit {
  schemeCode: number;
  name: string;
}


const FALLBACK_FUNDS: Array<{ schemeCode: string; name: string; categoryText: string }> = [
  { schemeCode: "fallback-hdfc-flexi-cap", name: "HDFC Flexi Cap Fund Direct Growth", categoryText: "Equity Scheme - Flexi Cap Fund" },
  { schemeCode: "fallback-parag-parikh-flexi-cap", name: "Parag Parikh Flexi Cap Fund Direct Growth", categoryText: "Equity Scheme - Flexi Cap Fund" },
  { schemeCode: "fallback-axis-bluechip", name: "Axis Bluechip Fund Direct Growth", categoryText: "Equity Scheme - Large Cap Fund" },
  { schemeCode: "fallback-icici-bluechip", name: "ICICI Prudential Bluechip Fund Direct Growth", categoryText: "Equity Scheme - Large Cap Fund" },
  { schemeCode: "fallback-nippon-small-cap", name: "Nippon India Small Cap Fund Direct Growth", categoryText: "Equity Scheme - Small Cap Fund" },
  { schemeCode: "fallback-sbi-small-cap", name: "SBI Small Cap Fund Direct Growth", categoryText: "Equity Scheme - Small Cap Fund" },
  { schemeCode: "fallback-kotak-emerging-equity", name: "Kotak Emerging Equity Fund Direct Growth", categoryText: "Equity Scheme - Mid Cap Fund" },
  { schemeCode: "fallback-motilal-midcap", name: "Motilal Oswal Midcap Fund Direct Growth", categoryText: "Equity Scheme - Mid Cap Fund" },
  { schemeCode: "fallback-uti-nifty-50", name: "UTI Nifty 50 Index Fund Direct Growth", categoryText: "Other Scheme - Index Fund" },
  { schemeCode: "fallback-hdfc-liquid", name: "HDFC Liquid Fund Direct Growth", categoryText: "Debt Scheme - Liquid Fund" },
];

function fallbackSearchResults(query: string): FundSearchResult[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  return FALLBACK_FUNDS.filter((fund) => {
    const haystack = `${fund.name} ${fund.categoryText}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  }).slice(0, 5).map((fund) => {
    const category = mapAmfiCategory(fund.categoryText, fund.name);
    return {
      provider: "mutual-fund-mcp",
      symbol: fund.schemeCode,
      name: fund.name,
      category,
      riskLevel: inferRiskLevel(category),
      sourceUrl: undefined,
      benchmark: undefined,
      expenseRatio: undefined,
      aum: undefined,
    };
  });
}
interface McpFundDetail {
  schemeCode: number;
  name: string;
  fundHouse: string;
  category: FundCategory;
  riskLevel: RiskLevel;
  nav?: number;
  navAsOf?: string;
  returns1Y?: number;
  returns3Y?: number;
  returns5Y?: number;
  isin?: string;
}

/**
 * Mutual fund search/details provider, backed by the MCP server in
 * lib/mcp/mutualFundMcpServer.ts (AMFI data via mfapi.in — see that file's
 * header comment for why this isn't literally Zerodha Kite data).
 */
class MutualFundMcpProvider implements FundDataProvider {
  id = "mutual-fund-mcp";
  label = "Mutual Fund MCP (AMFI data)";

  isConfigured() {
    return isMutualFundSourceConfigured();
  }

  async searchFunds(query: string): Promise<FundSearchResult[]> {
    let hits: McpSearchHit[] = [];
    try {
      const { json } = await callMutualFundTool("search_mutual_funds", { query, limit: 8 });
      hits = (json as { results?: McpSearchHit[] } | null)?.results || [];
    } catch (error) {
      console.warn(`${this.id} live fund search unavailable, using local fallback catalog:`, error);
      return fallbackSearchResults(query);
    }

    const detailed = await Promise.all(
      hits.slice(0, 5).map(async (hit) => {
        try {
          return await this.getFundDetails(String(hit.schemeCode));
        } catch {
          return null;
        }
      })
    );

    const detailedResults = detailed
      .filter((f): f is FundDetails => Boolean(f))
      .map((f) => ({
        provider: this.id,
        symbol: String(f.schemeCode),
        isin: f.isin,
        name: f.name,
        category: f.category,
        riskLevel: f.riskLevel,
        nav: f.nav,
        returns1Y: f.returns1Y,
        returns3Y: f.returns3Y,
        returns5Y: f.returns5Y,
        expenseRatio: undefined,
        aum: undefined,
        benchmark: undefined,
        sourceUrl: `https://www.mfapi.in/mf/${f.schemeCode}`,
        asOf: f.navAsOf,
      }));

    if (detailedResults.length > 0) return detailedResults;

    return hits.slice(0, 5).map((hit) => {
      const category = mapAmfiCategory("", hit.name);
      return {
        provider: this.id,
        symbol: String(hit.schemeCode),
        name: hit.name,
        category,
        riskLevel: inferRiskLevel(category),
        expenseRatio: undefined,
        aum: undefined,
        benchmark: undefined,
        sourceUrl: `https://www.mfapi.in/mf/${hit.schemeCode}`,
      };
    });
  }

  async getFundDetails(schemeCode: string): Promise<FundDetails> {
    const { json } = await callMutualFundTool("get_fund_details", { schemeCode });
    const detail = json as McpFundDetail | null;
    if (!detail) {
      throw new Error(`No details returned for scheme ${schemeCode}`);
    }
    return detail;
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
        ? "Live — AMFI-sourced NAV, returns, and category via MCP. No API key required."
        : "Credentials present."
      : "Not configured.",
  }));
}

export async function searchFunds(query: string): Promise<FundSearchResult[]> {
  const configuredProviders = providers.filter((provider) => provider.isConfigured());
  const results: FundSearchResult[] = [];

  for (const provider of configuredProviders) {
    try {
      results.push(...(await provider.searchFunds(query)));
    } catch (error) {
      console.warn(`${provider.id} fund search failed:`, error);
    }
  }

  return results;
}

export async function getFundDetails(schemeCode: string): Promise<FundDetails> {
  const provider = providers.find((p) => p.id === "mutual-fund-mcp") as MutualFundMcpProvider;
  return provider.getFundDetails(schemeCode);
}
