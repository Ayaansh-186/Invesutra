// Copyright © 2026 Ayaansh Singhal. All Rights Reserved.

import { NextRequest, NextResponse } from "next/server";
import { getProviderStatuses, searchFunds } from "@/lib/marketData/providers";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";
  const providers = getProviderStatuses();

  if (query.length < 2) {
    return NextResponse.json({
      funds: [],
      providers,
      message: "Enter at least 2 characters to search configured fund data providers.",
    });
  }

  const funds = await searchFunds(query);
  const hasLiveNav = funds.some((fund) => fund.nav !== undefined || fund.asOf);
  const hasFallback = funds.some((fund) => fund.symbol?.startsWith("fallback-"));
  return NextResponse.json({
    funds,
    providers,
    message:
      funds.length === 0
        ? "No matching funds found for that query."
        : hasLiveNav
          ? "Live results from the Mutual Fund MCP provider (AMFI data)."
          : hasFallback
            ? "Showing local fallback matches because live AMFI fund data is temporarily unavailable. Values are editable before saving."
            : "Showing AMFI search matches; detailed NAV data is temporarily unavailable. Values are editable before saving.",
  });
}
