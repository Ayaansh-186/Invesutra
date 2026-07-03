// Copyright © 2026 Ayaansh Singhal. All Rights Reserved.

import type { FundCategory, RiskLevel } from "@/lib/types";

export interface FundDetails {
  schemeCode: number;
  name: string;
  fundHouse?: string;
  category: FundCategory;
  riskLevel: RiskLevel;
  nav?: number;
  navAsOf?: string;
  returns1Y?: number;
  returns3Y?: number;
  returns5Y?: number;
  isin?: string;
}

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
  getFundDetails?(schemeCode: string): Promise<FundDetails>;
}

export interface ProviderStatus {
  id: string;
  label: string;
  configured: boolean;
  notes: string;
}
