import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { dbFundToFund, fundToDbInsert } from "@/lib/supabase/mappers";
import type { DbPurchase } from "@/lib/supabase/mappers";
import type { DbFund } from "@/lib/supabase/database.types";
import { getFundDetails } from "@/lib/marketData/providers";
import { isRecentNav } from "@/lib/marketData/navFreshness";
import { calculatePurchaseValues, isValidPurchaseDate } from "@/lib/utils/purchase";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function assertOwnsPortfolio(supabase: any, portfolioId: string, userId: string) {
  const { data } = await supabase
    .from("portfolios")
    .select("id")
    .eq("id", portfolioId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  if (!(await assertOwnsPortfolio(supabase, id, user.id))) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const { data, error } = await supabase.from("funds").select("*").eq("portfolio_id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: purchases, error: purchasesError } = await supabase.from("transactions")
    .select("fund_id, created_at, nav").eq("portfolio_id", id).eq("type", "buy");
  if (purchasesError) return NextResponse.json({ error: "Could not load purchase details." }, { status: 500 });
  const firstPurchaseByFund = new Map<string, DbPurchase>();
  for (const purchase of (purchases || []) as DbPurchase[]) {
    const earlier = firstPurchaseByFund.get(purchase.fund_id);
    if (!earlier || purchase.created_at < earlier.created_at) firstPurchaseByFund.set(purchase.fund_id, purchase);
  }
  const funds = ((data || []) as DbFund[]).map((fund) => dbFundToFund(fund, firstPurchaseByFund.get(fund.id)));
  return NextResponse.json({ funds });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  if (!(await assertOwnsPortfolio(supabase, id, user.id))) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const body = await request.json();
  const schemeCode = String(body.schemeCode || "").trim();
  const purchaseNav = Number(body.purchaseNav);
  const units = Number(body.units);
  const purchaseDate = String(body.purchaseDate || "").trim();

  if (!/^\d+$/.test(schemeCode)) {
    return NextResponse.json({ error: "Choose a fund from search to get its current NAV." }, { status: 400 });
  }
  if (!Number.isFinite(purchaseNav) || purchaseNav <= 0 || !Number.isFinite(units) || units <= 0) {
    return NextResponse.json({ error: "Purchase NAV and units must be greater than zero." }, { status: 400 });
  }
  if (!isValidPurchaseDate(purchaseDate)) {
    return NextResponse.json({ error: "Enter a valid purchase date that is not in the future." }, { status: 400 });
  }

  let detail;
  try {
    detail = await getFundDetails(schemeCode);
  } catch {
    return NextResponse.json({ error: "Fund NAV is unavailable. Please try again later." }, { status: 503 });
  }
  if (String(detail.schemeCode) !== schemeCode || !isRecentNav(detail.navAsOf) || !detail.nav) {
    return NextResponse.json({ error: "This fund has no recent NAV, so its current value cannot be calculated." }, { status: 422 });
  }
  const values = calculatePurchaseValues(purchaseNav, units, detail.nav);
  if (!values) {
    return NextResponse.json({ error: "Purchase values are invalid or too small to record." }, { status: 400 });
  }
  const name = detail.name;

  const { data: existingFunds } = await supabase
    .from("funds")
    .select("id, name")
    .eq("portfolio_id", id);
  const duplicate = (existingFunds as { id: string; name: string }[] | null)?.find(
    (fund) => fund.name.trim().toLowerCase() === name.toLowerCase()
  );
  if (duplicate) {
    return NextResponse.json({ error: `A fund named "${duplicate.name}" already exists in this portfolio.` }, { status: 409 });
  }

  const insertPayload = fundToDbInsert({
    name,
    category: detail.category,
    riskLevel: detail.riskLevel,
    investedAmount: values.investedAmount,
    currentValue: values.currentValue,
    nav: detail.nav,
    units,
    returns1Y: detail.returns1Y,
    returns3Y: detail.returns3Y,
    returns5Y: detail.returns5Y,
  }, id);

  const { data, error } = await supabase.from("funds").insert(insertPayload).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: transactionError } = await supabase.from("transactions").insert({
    fund_id: data.id,
    portfolio_id: id,
    user_id: user.id,
    type: "buy",
    amount: values.investedAmount,
    units,
    nav: purchaseNav,
    notes: `AMFI scheme ${schemeCode}`,
    created_at: `${purchaseDate}T12:00:00.000Z`,
  });
  if (transactionError) {
    const { error: rollbackError } = await supabase.from("funds").delete().eq("id", data.id);
    if (rollbackError) console.error("Could not roll back fund after purchase record failed:", rollbackError);
    return NextResponse.json({ error: "Could not save purchase details. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ fund: dbFundToFund(data as DbFund, {
    fund_id: data.id,
    created_at: `${purchaseDate}T12:00:00.000Z`,
    nav: purchaseNav,
  }) });
}
