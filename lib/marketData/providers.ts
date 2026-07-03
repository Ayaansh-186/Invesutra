// Copyright © 2026 Ayaansh Singhal. All Rights Reserved.

import type { FundCategory, RiskLevel } from "@/lib/types";
import type { FundDataProvider, FundDetails, FundSearchResult, ProviderStatus } from "./types";
import { callMutualFundTool } from "@/lib/mcp/mcpClient";
import { isMutualFundSourceConfigured } from "@/lib/mcp/mutualFundSource";

interface McpSearchHit {
  schemeCode: number;
  name: string;
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
    const { json } = await callMutualFundTool("search_mutual_funds", { query, limit: 8 });
    const hits = (json as { results?: McpSearchHit[] } | null)?.results || [];

    const detailed = await Promise.all(
      hits.slice(0, 5).map(async (hit) => {
        try {
          return await this.getFundDetails(String(hit.schemeCode));
        } catch {
          return null;
        }
      })
    );

    return detailed
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
