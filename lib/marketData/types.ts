import type { FundCategory, RiskLevel } from "@/lib/types";

export interface FundSearchResult {
  provider: string;
  symbol?: string;
  isin?: string;
  name: string;
  category?: FundCategory;
  riskLevel?: RiskLevel;
  nav?: number;
  returns1Y?: number;
  returns3Y?: number;
  returns5Y?: number;
  expenseRatio?: number;
  aum?: number;
  benchmark?: string;
  sourceUrl?: string;
  asOf?: string;
}

export interface FundDataProvider {
  id: string;
  label: string;
  isConfigured(): boolean;
  searchFunds(query: string): Promise<FundSearchResult[]>;
}

export interface ProviderStatus {
  id: string;
  label: string;
  configured: boolean;
  notes: string;
}
