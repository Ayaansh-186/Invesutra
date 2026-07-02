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
        ? "Live provider results returned."
        : "No live fund provider is enabled yet. The API contract is ready for a Zerodha, Yahoo Finance, or mutual fund data adapter.",
  });
}
