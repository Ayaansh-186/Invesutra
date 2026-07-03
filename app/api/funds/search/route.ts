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
  return NextResponse.json({
    funds,
    providers,
    message:
      funds.length > 0
        ? "Live results from the Mutual Fund MCP provider (AMFI data)."
        : "No matching funds found for that query.",
  });
}
