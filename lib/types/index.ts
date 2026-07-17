// Core domain types for Invesutra

export interface Fund {
  id: string;
  name: string;
  category: FundCategory;
  investedAmount: number;
  currentValue: number;
  nav: number;
  units: number;
  returns1Y: number;
  returns3Y: number;
  returns5Y: number;
  riskLevel: RiskLevel;
  expenseRatio: number;
  aum: number; // Assets under management in crores
  benchmark: string;
  manager: string;
  aiRecommendation?: AIRecommendation;
}

export type FundCategory =
  | "large_cap"
  | "mid_cap"
  | "small_cap"
  | "multi_cap"
  | "flexi_cap"
  | "debt"
  | "hybrid"
  | "index"
  | "sectoral"
  | "elss"
  | "international";

export type RiskLevel = "low" | "moderate" | "moderately_high" | "high" | "very_high";

export interface AIRecommendation {
  action: "hold" | "buy" | "reduce" | "exit";
  confidence: number; // 0-100
  rationale: string;
  targetAllocation?: number;
}

export interface Portfolio {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  funds: Fund[];
  totalInvested: number;
  currentValue: number;
  returns: number;
  returnsPercent: number;
  healthScore: number; // 0-100
  riskScore: number; // 0-100
  analysis?: PortfolioAnalysis;
}

export interface PortfolioAnalysis {
  overallHealth: "excellent" | "good" | "fair" | "poor";
  diversificationScore: number;
  concentrationRisk: ConcentrationRisk[];
  underperformers: string[]; // fund ids
  rebalancingSuggestions: RebalancingSuggestion[];
  aiInsights: string[];
  allocationBreakdown: AllocationBreakdown;
  riskMetrics: RiskMetrics;
}

export interface ConcentrationRisk {
  type: "category" | "sector" | "market_cap";
  label: string;
  currentPercent: number;
  recommendedMax: number;
  severity: "warning" | "critical";
}

export interface RebalancingSuggestion {
  fundId: string;
  fundName: string;
  action: "increase" | "decrease" | "reduce" | "exit";
  currentAllocation: number;
  targetAllocation: number;
  reasoning: string;
}

export interface AllocationBreakdown {
  byCategory: Record<FundCategory, number>;
  byRisk: Record<RiskLevel, number>;
  byMarketCap: { large: number; mid: number; small: number; other: number };
}

export interface RiskMetrics {
  beta: number;
  sharpeRatio: number;
  standardDeviation: number;
  maxDrawdown: number;
  valueAtRisk: number; // 95% VaR
}

// QuantRebalance Protocol Types
export interface QRPConfig {
  principalAmount: number;
  pillarBaseAmount?: number; // fixed A_i principal per fund slot
  alphaTriggerPercent: number; // e.g. 12 = 12%
  drawbackPercent: number; // e.g. 10 = 10%
  dryPowderPercent: number; // e.g. 20 = 20%
  milestones: number[]; // % gain milestones to trigger rebalancing
}

export interface QRPState {
  principalLayer: number;
  alphaPool: number;
  dryPowder: number;
  activeDeployment: number;
  currentValue: number;
  totalReturns: number;
  totalReturnsPercent: number;
  lastRebalanceDate?: string;
  rebalanceHistory: RebalanceEvent[];
}

export interface RebalanceEvent {
  date: string;
  trigger: string;
  portfolioValueBefore: number;
  portfolioValueAfter: number;
  alphaCaptured: number;
  dryPowderAdded: number;
  actions: string[];
}

// Simulation types
export interface SimulationInput {
  initialInvestment: number;
  monthlyAddition: number;
  years: number;
  expectedReturn: number; // annual %
  marketCondition: "bull" | "bear" | "sideways" | "volatile";
  triggerPercent: number;
  enableRebalancing: boolean;
  funds: SimFund[];
}

export interface SimFund {
  name: string;
  allocation: number; // %
  expectedReturn: number;
  category: FundCategory;
  riskLevel: RiskLevel;
}

export interface SimulationResult {
  months: SimulationMonth[];
  finalValue: number;
  totalInvested: number;
  totalReturns: number;
  totalReturnsPercent: number;
  alphaGenerated: number;
  rebalanceCount: number;
  maxDrawdown: number;
  sharpeRatio: number;
  fundBreakdown: SimFundResult[];
  comparison: {
    withRebalancing: number;
    withoutRebalancing: number;
    difference: number;
    differencePercent: number;
  };
}

export interface SimFundResult {
  name: string;
  category: FundCategory;
  allocationPercent: number;
  finalValue: number;
  contributionToReturn: number; // % of total portfolio gain attributable to this fund
}

export interface SimulationMonth {
  month: number;
  date: string;
  portfolioValue: number;
  invested: number;
  returns: number;
  rebalanced: boolean;
  alphaCaptured?: number;
}

// User and subscription types
export interface User {
  id: string;
  email: string;
  name: string;
  plan: "free" | "pro" | "premium";
  createdAt: string;
}

export interface AIReport {
  id: string;
  portfolioId: string;
  generatedAt: string;
  summary: string;
  healthScore: number;
  detectedIssues: Issue[];
  recommendations: string[];
  algorithmExplanation: string;
}

export interface Issue {
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  affectedFunds?: string[];
}
