import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
    .order("generated_at", { ascending: false });

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

  const body = await request.json();

  if (!body.portfolioId) {
    return NextResponse.json({ error: "portfolioId is required" }, { status: 400 });
  }

  const { data: ownedPortfolio, error: ownershipError } = await supabase.from("portfolios")
    .select("id").eq("id", body.portfolioId).eq("user_id", user.id).maybeSingle();
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
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from("ai_reports")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("generated_at", startOfMonth.toISOString());

    if ((count || 0) >= 3) {
      return NextResponse.json(
        { error: "Report generation is currently limited to 3 reports per month." },
        { status: 403 }
      );
    }
  }

  const { data, error } = await supabase
    .from("ai_reports")
    .insert({
      portfolio_id: body.portfolioId,
      user_id: user.id,
      health_score: body.healthScore ?? 0,
      overall_health: body.overallHealth ?? "fair",
      summary: body.summary ?? "",
      issues: body.issues ?? [],
      recommendations: body.recommendations ?? [],
      risk_metrics: body.riskMetrics ?? {},
      allocation_breakdown: body.allocationBreakdown ?? {},
      algorithm_explanation: body.algorithmExplanation ?? "",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ report: data });
}
