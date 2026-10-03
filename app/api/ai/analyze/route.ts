import { NextRequest, NextResponse } from "next/server";
import { analyzePortfolioWithAI } from "@/lib/ai/analyze";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Portfolio } from "@/lib/types";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { buildPortfolio, type DbPurchase } from "@/lib/supabase/mappers";
import { hydratePortfolioValuations } from "@/lib/marketData/valuation";
import type { DbFund, DbPortfolio } from "@/lib/supabase/database.types";

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(request, "ai-analyze", 12, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many analysis requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  try {
    const body = await request.json();
    let portfolio = body.portfolio as Portfolio | undefined;

    if (!portfolio || !Array.isArray(portfolio.funds)) {
      return NextResponse.json(
        { error: "Request body must include a `portfolio` object with a `funds` array." },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: owned, error } = await supabase.from("portfolios").select("*").eq("id", portfolio.id).eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      if (!owned) return NextResponse.json({ error: "Saved portfolio not found." }, { status: 404 });
      const { data: funds, error: fundError } = await supabase.from("funds").select("*").eq("portfolio_id", portfolio.id);
      const { data: purchases, error: purchaseError } = await supabase.from("transactions").select("id, fund_id, created_at, nav, notes, units, amount").eq("portfolio_id", portfolio.id).eq("type", "buy");
      if (fundError || purchaseError) throw fundError || purchaseError;
      portfolio = await hydratePortfolioValuations(buildPortfolio(owned as DbPortfolio, (funds || []) as DbFund[], (purchases || []) as DbPurchase[]));
    }
    const result = await analyzePortfolioWithAI(portfolio, { allowPrivateAI: body.allowPrivateAI === true });

    // Best-effort: persist a snapshot to analysis_history if the user is
    // signed in and Supabase is configured. Never block the response on this.
    try {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase.from("analysis_history").insert({
          portfolio_id: portfolio.id,
          user_id: user.id,
          health_score: result.healthScore,
          risk_score: portfolio.riskScore ?? 0,
          diversification_score: result.diversificationScore,
          total_value: portfolio.currentValue,
          total_invested: portfolio.totalInvested,
          snapshot: result as unknown as Record<string, unknown>,
        });
      }
    } catch {
      // Non-fatal — Supabase may not be configured locally.
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("AI analyze route error:", error);
    return NextResponse.json({ error: error.message || "Analysis failed" }, { status: 500 });
  }
}
