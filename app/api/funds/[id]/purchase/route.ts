import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getFundDetails } from "@/lib/marketData/providers";
import { getPurchaseQuote } from "@/lib/marketData/purchaseQuote";
import { isRecentNav } from "@/lib/marketData/navFreshness";
import { isExchangeTradedFund } from "@/lib/marketData/amfi";
import { calculatePurchaseValues } from "@/lib/utils/purchase";
import { parsePurchaseCorrection, purchaseHistoryRepairError } from "@/lib/utils/holdingRepair";
import { dbFundToFund } from "@/lib/supabase/mappers";
import { hydrateFundValuations } from "@/lib/marketData/valuation";
import type { DbFund } from "@/lib/supabase/database.types";
import { checkRateLimit } from "@/lib/security/rateLimit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const rate = checkRateLimit(request, `purchase-entry:${user.id}:${id}`, 8, 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "Please wait before recording more purchases." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const { data: holding, error: holdingError } = await supabase.from("funds").select("*").eq("id", id).maybeSingle();
  if (holdingError) return NextResponse.json({ error: "Could not load holding." }, { status: 500 });
  if (!holding) return NextResponse.json({ error: "Holding not found" }, { status: 404 });
  const { data: owner } = await supabase.from("portfolios").select("id").eq("id", holding.portfolio_id).eq("user_id", user.id).maybeSingle();
  if (!owner) return NextResponse.json({ error: "Holding not found" }, { status: 404 });
  if (isExchangeTradedFund(holding.name)) return NextResponse.json({ error: "Only mutual-fund allotments are supported." }, { status: 422 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid purchase details." }, { status: 400 }); }
  const inputs: unknown[] = Array.isArray(body?.purchases) ? body.purchases : [body];
  if (!inputs.length || inputs.length > 200) return NextResponse.json({ error: "Record between 1 and 200 purchases." }, { status: 400 });
  const purchases = inputs.map(input => {
    const parsed = parsePurchaseCorrection(input);
    const requestId = input && typeof input === "object" ? (input as Record<string, unknown>).requestId : null;
    return parsed && typeof requestId === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(requestId) ? { ...parsed, requestId } : null;
  });
  if (purchases.some(item => !item) || new Set(purchases.map(item => item?.requestId)).size !== purchases.length) return NextResponse.json({ error: "Each purchase needs valid allotment details and a unique request ID." }, { status: 400 });
  const { data: history, error: historyError } = await supabase.from("transactions").select("*").eq("fund_id", id);
  if (historyError) return NextResponse.json({ error: "Could not verify purchase history." }, { status: 500 });
  const code = purchases[0]!.schemeCode;
  if (!history?.length || history.some(item => item.type !== "buy" || item.notes !== `AMFI scheme ${code}`) || purchases.some(item => item!.schemeCode !== code)) return NextResponse.json({ error: "Use the exact existing scheme. Correct incomplete purchase records first." }, { status: 409 });
  try {
    const detail = await getFundDetails(code);
    if (String(detail.schemeCode) !== code || !isRecentNav(detail.navAsOf) || !detail.nav || isExchangeTradedFund(detail.name)) return NextResponse.json({ error: "A recent verified NAV is required." }, { status: 422 });
    const [verified] = await hydrateFundValuations([dbFundToFund(holding as DbFund, history)]);
    if (verified.purchaseStatus !== "verified") return NextResponse.json({ error: "Correct existing purchase records before recording more payments." }, { status: 409 });
    const records = [];
    for (const purchase of purchases) {
      const quote = await getPurchaseQuote(detail, purchase!.purchaseDate);
      if (!quote || Math.abs(quote.nav - purchase!.purchaseNav) > Math.max(0.001, quote.nav * 0.0001)) return NextResponse.json({ error: `Buying NAV does not match the published NAV on ${purchase!.purchaseDate}. Nothing was saved.` }, { status: 422 });
      records.push({ ...purchase!, purchaseNav: quote.nav, latestNav: detail.nav });
    }
    const { error } = await supabase.rpc("record_fund_purchases", { p_fund_id: id, p_purchases: records });
    if (error) return NextResponse.json({ error: error.code === "P0001" ? error.message : "Could not save purchases. No partial purchase batch was saved." }, { status: error.code === "P0001" ? 409 : 503 });
    return NextResponse.json({ recorded: true, fundId: id, count: records.length });
  } catch { return NextResponse.json({ error: "Published NAV verification is unavailable. Nothing was saved; please retry later." }, { status: 503 }); }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: holding, error: holdingError } = await supabase.from("funds")
    .select("id, portfolio_id, name").eq("id", id).maybeSingle();
  if (holdingError) return NextResponse.json({ error: "Could not load holding." }, { status: 500 });
  if (!holding) return NextResponse.json({ error: "Holding not found" }, { status: 404 });
  const { data: owner } = await supabase.from("portfolios").select("id")
    .eq("id", holding.portfolio_id).eq("user_id", user.id).maybeSingle();
  if (!owner) return NextResponse.json({ error: "Holding not found" }, { status: 404 });
  if (isExchangeTradedFund(holding.name)) return NextResponse.json({ error: "ETF corrections need a verified exchange-price source." }, { status: 422 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid purchase details." }, { status: 400 }); }
  const purchase = parsePurchaseCorrection(body);
  if (!purchase) return NextResponse.json({ error: "Choose a scheme and enter a valid allotment date, positive buying NAV and units with at most four decimal places." }, { status: 400 });
  const { data: history, error: historyError } = await supabase.from("transactions")
    .select("type, notes").eq("fund_id", id);
  if (historyError) return NextResponse.json({ error: "Could not verify purchase history." }, { status: 500 });
  const historyProblem = purchaseHistoryRepairError(history || [], purchase.schemeCode);
  if (historyProblem) return NextResponse.json({ error: historyProblem }, { status: 409 });
  let detail;
  let quote;
  try {
    detail = await getFundDetails(purchase.schemeCode);
    if (String(detail.schemeCode) !== purchase.schemeCode || !isRecentNav(detail.navAsOf) ||
        !Number.isFinite(detail.nav) || (detail.nav || 0) <= 0 || isExchangeTradedFund(detail.name)) {
      return NextResponse.json({ error: "This scheme has no verified recent mutual-fund NAV." }, { status: 422 });
    }
    quote = await getPurchaseQuote(detail, purchase.purchaseDate);
  } catch {
    return NextResponse.json({ error: "Published NAV data is unavailable. Nothing was changed; please try again later." }, { status: 503 });
  }
  if (!quote || Math.abs(purchase.purchaseNav - quote.nav) > Math.max(0.001, quote.nav * 0.0001)) {
    return NextResponse.json({ error: "Buying NAV does not match the published NAV for this scheme and allotment date." }, { status: 422 });
  }
  const values = calculatePurchaseValues(quote.nav, purchase.units, detail.nav!);
  if (!values || values.investedAmount >= 1e12 || values.currentValue <= 0 || values.currentValue >= 1e12) {
    return NextResponse.json({ error: "Purchase values are outside the supported range." }, { status: 400 });
  }
  const { error } = await supabase.rpc("repair_fund_purchase", {
    p_fund_id: id,
    p_purchase: {
      ...purchase, purchaseNav: quote.nav, latestNav: detail.nav,
      name: detail.name, category: detail.category, riskLevel: detail.riskLevel,
      navAsOf: detail.navAsOf, sourceUrl: detail.sourceUrl || null,
    },
  });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") {
      return NextResponse.json({ error: "Purchase corrections require database migration 003. Nothing was changed. Please contact the app administrator." }, { status: 503 });
    }
    if (error.code === "P0001") return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("Holding correction failed", { code: error.code });
    return NextResponse.json({ error: "Could not save correction. Nothing was changed." }, { status: 500 });
  }
  return NextResponse.json({ corrected: true, fundId: id, navAsOf: detail.navAsOf });
}
