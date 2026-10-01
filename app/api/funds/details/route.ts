// Copyright © 2026 Ayaansh Singhal. All Rights Reserved.

import { NextRequest, NextResponse } from "next/server";
import { getFundDetails } from "@/lib/marketData/providers";
import { getPurchaseQuote } from "@/lib/marketData/purchaseQuote";
import { isValidPurchaseDate } from "@/lib/utils/purchase";
import { isRecentNav } from "@/lib/marketData/navFreshness";
import { checkRateLimit } from "@/lib/security/rateLimit";

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(request, "fund-details", 40, 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "Please wait a moment before checking another NAV." }, { status: 429 });
  const schemeCode = request.nextUrl.searchParams.get("schemeCode")?.trim();
  const purchaseDate = request.nextUrl.searchParams.get("purchaseDate")?.trim();

  if (!schemeCode || !/^\d+$/.test(schemeCode)) {
    return NextResponse.json({ error: "schemeCode query parameter is required." }, { status: 400 });
  }
  if (purchaseDate && !isValidPurchaseDate(purchaseDate)) return NextResponse.json({ error: "Enter a valid allotment date that is not in the future." }, { status: 400 });

  try {
    const fund = await getFundDetails(schemeCode);
    if (!fund.nav || !isRecentNav(fund.navAsOf)) return NextResponse.json({ error: "A recent published NAV is unavailable for this scheme." }, { status: 422 });
    const purchase = purchaseDate ? await getPurchaseQuote(fund, purchaseDate) : undefined;
    if (purchaseDate && !purchase) return NextResponse.json({ fund, error: "No NAV was published on this date. Use the allotment date on your statement, or wait until that day's NAV is published." }, { status: 422 });
    return NextResponse.json({ fund, purchase });
  } catch (error: any) {
    return NextResponse.json(
      { error: "NAV lookup is temporarily unavailable. Please try again." },
      { status: 502 }
    );
  }
}
