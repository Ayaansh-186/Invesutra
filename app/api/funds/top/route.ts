import { NextRequest, NextResponse } from "next/server";
import { loadShortlist, rankFunds, SHORTLIST_QUERIES } from "@/lib/marketData/topFunds";
import type { RankingPeriod, RankedFund } from "@/lib/marketData/topFunds";
import { checkRateLimit } from "@/lib/security/rateLimit";

let cached: { at: number; funds: RankedFund[] } | null = null;
let pending: Promise<RankedFund[]> | null = null;

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(request, "top-funds", 12, 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many requests. Please retry shortly." }, { status: 429 });
  const requested = request.nextUrl.searchParams.get("period");
  const period: RankingPeriod = requested === "3Y" || requested === "5Y" ? requested : "1Y";
  try {
    if (!cached || Date.now() - cached.at > 15 * 60 * 1000) {
      pending ??= loadShortlist().finally(() => { pending = null; });
      const funds = await pending;
      if (funds.length === 0) throw new Error("No recent NAVs were returned");
      cached = { at: Date.now(), funds };
    }
    return NextResponse.json({
      funds: rankFunds(cached.funds, period),
      period,
      universe: `${cached.funds.length} verified schemes from ${SHORTLIST_QUERIES.length} named comparison queries`,
      checkedAt: new Date(cached.at).toISOString(),
      source: "https://portal.amfiindia.com/spages/NAVAll.txt",
    });
  } catch {
    return NextResponse.json({ error: "Recent published NAV data is unavailable. The ranking cannot be verified right now." }, { status: 503 });
  }
}
