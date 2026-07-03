// Copyright © 2026 Ayaansh Singhal. All Rights Reserved.

import { NextRequest, NextResponse } from "next/server";
import { getFundDetails } from "@/lib/marketData/providers";

export async function GET(request: NextRequest) {
  const schemeCode = request.nextUrl.searchParams.get("schemeCode")?.trim();

  if (!schemeCode) {
    return NextResponse.json({ error: "schemeCode query parameter is required." }, { status: 400 });
  }

  try {
    const fund = await getFundDetails(schemeCode);
    return NextResponse.json({ fund });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch fund details." },
      { status: 502 }
    );
  }
}
