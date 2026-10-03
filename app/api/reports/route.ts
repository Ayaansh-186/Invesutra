import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildPortfolio, type DbPurchase } from "@/lib/supabase/mappers";
import type { DbFund, DbPortfolio } from "@/lib/supabase/database.types";
import { hydratePortfolioValuations } from "@/lib/marketData/valuation";
import { isPortfolioDataReady } from "@/lib/marketData/quality";
import { generateReport } from "@/lib/algorithm/reportEngine";
import { todayInIndia } from "@/lib/utils/purchase";

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const portfolioId = searchParams.get("portfolioId");

  let query = supabase
    .from("ai_reports")
    .select("*")
    .eq("user_id", user.id)
    .order("generated_at", { ascending: false }).limit(50);

  if (portfolioId) {
    query = query.eq("portfolio_id", portfolioId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reports: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid report request." }, { status: 400 });
  }

  if (!body || typeof body.portfolioId !== "string" || !body.portfolioId.trim()) {
    return NextResponse.json({ error: "portfolioId is required" }, { status: 400 });
  }

  const { data: ownedPortfolio, error: ownershipError } = await supabase.from("portfolios")
    .select("*").eq("id", body.portfolioId).eq("user_id", user.id).maybeSingle();
  if (ownershipError) return NextResponse.json({ error: "Could not verify portfolio ownership." }, { status: 500 });
  if (!ownedPortfolio) return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });

  // Enforce the Free plan's 3-reports-per-month cap server-side.
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", user.id)
    .maybeSingle();

  const plan = (subscription as { plan?: string } | null)?.plan || "free";

  if (plan === "free") {
    const startOfMonth = new Date(`${todayInIndia().slice(0, 7)}-01T00:00:00+05:30`);

    const { count, error: countError } = await supabase
      .from("ai_reports")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("generated_at", startOfMonth.toISOString());
    if (countError) return NextResponse.json({ error: "Could not check your report history. Please try again." }, { status: 503 });

    if ((count || 0) >= 3) {
      return NextResponse.json(
        { error: "Report generation is currently limited to 3 reports per month." },
        { status: 403 }
      );
    }
  }

  const { data: funds, error: fundError } = await supabase.from("funds").select("*").eq("portfolio_id", body.portfolioId);
  const { data: purchases, error: purchaseError } = await supabase.from("transactions")
    .select("fund_id, created_at, nav, notes").eq("portfolio_id", body.portfolioId).eq("type", "buy");
  if (fundError || purchaseError) return NextResponse.json({ error: "Could not load verified holdings for the report." }, { status: 503 });
  const portfolio = await hydratePortfolioValuations(buildPortfolio(ownedPortfolio as DbPortfolio, (funds || []) as DbFund[], (purchases || []) as DbPurchase[]));
  if (!portfolio.funds.length || !isPortfolioDataReady(portfolio)) return NextResponse.json({ error: "Verify your holdings' NAVs and purchase details before generating a report." }, { status: 422 });
  const result = generateReport(portfolio);
  const { data, error } = await supabase
    .from("ai_reports")
    .insert({
      portfolio_id: body.portfolioId,
      user_id: user.id,
      health_score: result.healthScore,
      overall_health: result.overallHealth,
      summary: result.summary,
      issues: result.issues,
      recommendations: result.recommendations,
      risk_metrics: result.riskMetrics,
      allocation_breakdown: result.allocationBreakdown,
      algorithm_explanation: result.algorithmExplanation,
      report_snapshot: { version: 1, report: result },
    })
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST204" || error.code === "42703") return NextResponse.json({ error: "Saving full reports requires database migration 005. No report was saved; please contact the app administrator." }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ report: data });
}
