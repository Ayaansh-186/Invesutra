// TypeScript types mirroring the Supabase database schema.
// Keep in sync with /supabase/schema.sql

export type PlanTier = "free" | "pro" | "premium";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "cancelled" | "incomplete";

export interface DbUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbPortfolio {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbFund {
  id: string;
  portfolio_id: string;
  name: string;
  category: string;
  invested_amount: number;
  current_value: number;
  nav: number;
  units: number;
  returns_1y: number;
  returns_3y: number;
  returns_5y: number;
  risk_level: string;
  expense_ratio: number;
  aum: number;
  benchmark: string | null;
  manager: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbTransaction {
  id: string;
  fund_id: string;
  portfolio_id: string;
  user_id: string;
  type: "buy" | "sell" | "rebalance" | "dividend";
  amount: number;
  units: number | null;
  nav: number | null;
  notes: string | null;
  created_at: string;
}

export interface DbAIReport {
  id: string;
  portfolio_id: string;
  user_id: string;
  health_score: number;
  overall_health: string;
  summary: string;
  issues: unknown; // jsonb
  recommendations: unknown; // jsonb
  risk_metrics: unknown; // jsonb
  allocation_breakdown: unknown; // jsonb
  algorithm_explanation: string;
  generated_at: string;
}

export interface DbSubscription {
  id: string;
  user_id: string;
  plan: PlanTier;
  status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbAnalysisHistory {
  id: string;
  portfolio_id: string;
  user_id: string;
  health_score: number;
  risk_score: number;
  diversification_score: number;
  total_value: number;
  total_invested: number;
  snapshot: unknown; // jsonb full analysis snapshot
  created_at: string;
}

export interface DbChatMessage {
  id: string;
  portfolio_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      users: { Row: DbUser; Insert: Partial<DbUser>; Update: Partial<DbUser>; Relationships: [] };
      portfolios: { Row: DbPortfolio; Insert: Partial<DbPortfolio>; Update: Partial<DbPortfolio>; Relationships: [] };
      funds: { Row: DbFund; Insert: Partial<DbFund>; Update: Partial<DbFund>; Relationships: [] };
      transactions: { Row: DbTransaction; Insert: Partial<DbTransaction>; Update: Partial<DbTransaction>; Relationships: [] };
      ai_reports: { Row: DbAIReport; Insert: Partial<DbAIReport>; Update: Partial<DbAIReport>; Relationships: [] };
      subscriptions: { Row: DbSubscription; Insert: Partial<DbSubscription>; Update: Partial<DbSubscription>; Relationships: [] };
      analysis_history: { Row: DbAnalysisHistory; Insert: Partial<DbAnalysisHistory>; Update: Partial<DbAnalysisHistory>; Relationships: [] };
      chat_messages: { Row: DbChatMessage; Insert: Partial<DbChatMessage>; Update: Partial<DbChatMessage>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
