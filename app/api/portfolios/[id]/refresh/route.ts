import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getFundDetails, searchFunds } from "@/lib/marketData/providers";
import { findExactLiveFund } from "@/lib/marketData/matchFund";
import { isRecentNav } from "@/lib/marketData/navFreshness";

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
    .eq("portfolio_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: purchases, error: purchasesError } = await supabase.from("transactions")
    .select("fund_id, notes").eq("portfolio_id", id).eq("type", "buy");
  if (purchasesError) return NextResponse.json({ error: "Could not verify saved scheme identifiers." }, { status: 500 });
  const schemeCodes = new Map<string, string>();
  for (const purchase of purchases || []) {
    const code = /^AMFI scheme (\d+)$/.exec(purchase.notes || "")?.[1];
    if (code) schemeCodes.set(purchase.fund_id, code);
  }

  let updated = 0;
  const unavailable: string[] = [];

  const rows = funds || [];
  for (let offset = 0; offset < rows.length; offset += 4) {
    await Promise.all(rows.slice(offset, offset + 4).map(async (fund) => {
      try {
        const units = Number(fund.units);
        if (!Number.isFinite(units) || !(units > 0) || /\bETF\b/i.test(fund.name)) {
          unavailable.push(fund.name);
          return;
        }
        const code = schemeCodes.get(fund.id);
        let match;
        if (code) {
          const detail = await getFundDetails(code);
          if (String(detail.schemeCode) !== code || !isRecentNav(detail.navAsOf)) {
            unavailable.push(fund.name);
            return;
          }
          match = detail;
        } else {
          match = findExactLiveFund(fund.name, await searchFunds(fund.name));
        }
        if (!match?.nav || !Number.isFinite(match.nav) || match.nav <= 0) {
          unavailable.push(fund.name);
          return;
        }

        const nextValue = Number((units * match.nav).toFixed(2));
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
  }

  return NextResponse.json({
    updated,
    total: funds?.length || 0,
    unavailable,
    checkedAt: new Date().toISOString(),
  });
}
