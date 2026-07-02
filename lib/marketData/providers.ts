import type { FundDataProvider, FundSearchResult, ProviderStatus } from "./types";

class ZerodhaProvider implements FundDataProvider {
  id = "zerodha";
  label = "Zerodha MCP / Kite data provider";

  isConfigured() {
    return Boolean(process.env.ZERODHA_MCP_SERVER_URL || process.env.ZERODHA_API_KEY);
  }

  async searchFunds(_query: string): Promise<FundSearchResult[]> {
    throw new Error("Zerodha provider is not wired yet. Configure a server-side MCP/API bridge first.");
  }
}

class YahooFinanceProvider implements FundDataProvider {
  id = "yahoo-finance";
  label = "Yahoo Finance provider";

  isConfigured() {
    return Boolean(process.env.YAHOO_FINANCE_MCP_SERVER_URL || process.env.YAHOO_FINANCE_API_KEY);
  }

  async searchFunds(_query: string): Promise<FundSearchResult[]> {
    throw new Error("Yahoo Finance provider is not wired yet. Configure a server-side MCP/API bridge first.");
  }
}

const providers: FundDataProvider[] = [new ZerodhaProvider(), new YahooFinanceProvider()];

export function getProviderStatuses(): ProviderStatus[] {
  return providers.map((provider) => ({
    id: provider.id,
    label: provider.label,
    configured: provider.isConfigured(),
    notes: provider.isConfigured()
      ? "Credentials are present; implement the provider adapter before enabling live search."
      : "Not configured. Add provider credentials or an MCP bridge URL before enabling live data.",
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
