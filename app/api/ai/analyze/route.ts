import { NextRequest, NextResponse } from "next/server";
import { analyzePortfolioWithAI } from "@/lib/ai/analyze";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Portfolio } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const portfolio = body.portfolio as Portfolio | undefined;

    if (!portfolio || !Array.isArray(portfolio.funds)) {
      return NextResponse.json(
        { error: "Request body must include a `portfolio` object with a `funds` array." },
        { status: 400 }
      );
    }

    const result = await analyzePortfolioWithAI(portfolio);

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
