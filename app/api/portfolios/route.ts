import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildPortfolio } from "@/lib/supabase/mappers";
import type { DbFund, DbPortfolio } from "@/lib/supabase/database.types";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: portfolios, error: portfolioError } = await supabase
    .from("portfolios")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (portfolioError) {
    console.error("portfolios fetch error:", portfolioError.code, portfolioError.message);

    // "42P01" = table doesn't exist yet (DB not migrated). Fall back to an
    // empty list so the dashboard can still render in demo mode.
    if (portfolioError.code === "42P01") {
      return NextResponse.json({ portfolios: [] });
    }

    // "42501" = permission denied — a real misconfiguration (missing GRANTs
    // or RLS policy), not an empty-state. Surface it instead of hiding it,
    // otherwise this is impossible to debug from the UI.
    return NextResponse.json(
      {
        portfolios: [],
        error:
          portfolioError.code === "42501"
            ? "Database permission denied. Run supabase/migrations/002_grants_fix.sql in the Supabase SQL editor."
            : portfolioError.message,
      },
      { status: 500 }
    );
  }

  if (!portfolios || portfolios.length === 0) {
    return NextResponse.json({ portfolios: [] });
  }

  const portfolioIds = (portfolios as DbPortfolio[]).map((p) => p.id);
  const { data: funds, error: fundsError } = await supabase
    .from("funds")
    .select("*")
    .in("portfolio_id", portfolioIds);

  if (fundsError) {
    console.error("funds fetch error:", fundsError.message);
    // Return portfolios without fund detail rather than crashing
    return NextResponse.json({
      portfolios: (portfolios as DbPortfolio[]).map((p) => buildPortfolio(p, [])),
    });
  }

  const fundsByPortfolio = new Map<string, DbFund[]>();
  for (const fund of (funds || []) as DbFund[]) {
    const list = fundsByPortfolio.get(fund.portfolio_id) || [];
    list.push(fund);
    fundsByPortfolio.set(fund.portfolio_id, list);
  }

  const result = (portfolios as DbPortfolio[]).map((p) =>
    buildPortfolio(p, fundsByPortfolio.get(p.id) || [])
  );

  return NextResponse.json({ portfolios: result });
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
  const name = (body.name as string)?.trim();

  if (!name) {
    return NextResponse.json({ error: "Portfolio name is required" }, { status: 400 });
  }

  // Enforce Free plan's 1-portfolio limit server-side
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", user.id)
    .maybeSingle();

  const plan = (subscription as { plan?: string } | null)?.plan || "free";

  if (plan === "free") {
    const { count } = await supabase
      .from("portfolios")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if ((count || 0) >= 1) {
      return NextResponse.json(
        { error: "Free plan is limited to 1 portfolio. Upgrade to Pro for unlimited portfolios." },
        { status: 403 }
      );
    }
  }

  const { data, error } = await supabase
    .from("portfolios")
    .insert({ user_id: user.id, name, description: body.description ?? null })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ portfolio: data });
}
