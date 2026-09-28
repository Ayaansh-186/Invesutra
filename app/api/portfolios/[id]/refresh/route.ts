import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { searchFunds } from "@/lib/marketData/providers";
import { findExactLiveFund } from "@/lib/marketData/matchFund";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!portfolio) return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });

  const { data: funds, error } = await supabase
    .from("funds")
    .select("id, name, units, current_value")
    .eq("portfolio_id", id)
    .limit(8);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let updated = 0;
  const unavailable: string[] = [];

  await Promise.all((funds || []).map(async (fund) => {
    try {
      const matches = await searchFunds(fund.name);
      const match = findExactLiveFund(fund.name, matches);
      if (!match?.nav) {
        unavailable.push(fund.name);
        return;
      }

      const units = Number(fund.units);
      const nextValue = units > 0 ? Number((units * match.nav).toFixed(2)) : Number(fund.current_value);
      const { error: updateError } = await supabase.from("funds").update({
        nav: match.nav,
        current_value: nextValue,
        ...(match.returns1Y !== undefined ? { returns_1y: match.returns1Y } : {}),
        ...(match.returns3Y !== undefined ? { returns_3y: match.returns3Y } : {}),
        ...(match.returns5Y !== undefined ? { returns_5y: match.returns5Y } : {}),
      }).eq("id", fund.id);
      if (updateError) unavailable.push(fund.name);
      else updated += 1;
    } catch {
      unavailable.push(fund.name);
    }
  }));

  return NextResponse.json({
    updated,
    total: funds?.length || 0,
    unavailable,
    checkedAt: new Date().toISOString(),
  });
}
