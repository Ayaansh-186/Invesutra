// Copyright © 2026 Ayaansh Singhal. All Rights Reserved.

import { NextRequest, NextResponse } from "next/server";
import { getProviderStatuses, searchFunds } from "@/lib/marketData/providers";
import { checkRateLimit } from "@/lib/security/rateLimit";

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(request, "fund-search", 40, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many fund searches. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() || "";
  const plan = request.nextUrl.searchParams.get("plan") || "all";
  const option = request.nextUrl.searchParams.get("option") || "all";
  const providers = getProviderStatuses();

  if (query.length < 2) {
    return NextResponse.json({
      funds: [],
      providers,
      message: "Enter at least 2 characters to search configured fund data providers.",
    });
  }

  let funds;
  try {
    funds = await searchFunds([query, ["direct", "regular"].includes(plan) ? plan : "", ["growth", "idcw"].includes(option) ? option : ""].filter(Boolean).join(" "));
  } catch {
    return NextResponse.json({ error: "Published NAV data is unavailable. Please try again later." }, { status: 503 });
  }
  const hasLiveNav = funds.some((fund) => fund.dataQuality === "live");
  return NextResponse.json({
    funds,
    providers,
    message:
      funds.length === 0
        ? "No matching schemes with a recent published NAV. Try a more specific name or different filters."
        : hasLiveNav
          ? "Latest published NAVs from AMFI."
        : "Only schemes with a recent published NAV can be added; older schemes are shown for identification only.",
  });
}
