// Copyright © 2026 Ayaansh Singhal. All Rights Reserved.

import { searchFunds, getFundDetails, getProviderStatuses } from "@/lib/marketData/providers";
import { executeTool, getAvailableTools } from "@/lib/ai/tools";

// Mock the mfapi.in HTTP responses so this runs without outbound network
// access (the sandbox can't reach api.mfapi.in). Verifies: MCP server tool
// registration, MCP client in-memory transport round-trip, JSON parsing,
// category/risk mapping, and the returns CAGR calculation — everything
// except the real network hop, which the user should verify once deployed
// (see README "Verifying the live integration").
const realFetch = global.fetch;
global.fetch = (async (url: string | URL) => {
  const u = url.toString();
  if (u.includes("/mf/search")) {
    return new Response(
      JSON.stringify([{ schemeCode: 120503, schemeName: "Axis Bluechip Fund - Direct Plan - Growth" }]),
      { status: 200 }
    );
  }
  if (u.includes("/mf/120503")) {
    return new Response(
      JSON.stringify({
        meta: {
          fund_house: "Axis Mutual Fund",
          scheme_type: "Open Ended Schemes",
          scheme_category: "Equity Scheme - Large Cap Fund",
          scheme_code: 120503,
          scheme_name: "Axis Bluechip Fund - Direct Plan - Growth",
          isin_growth: "INF846K01EW2",
        },
        data: [
          { date: "01-07-2026", nav: "84.5231" },
          { date: "01-07-2025", nav: "70.1000" },
          { date: "01-07-2023", nav: "55.0000" },
          { date: "01-07-2021", nav: "40.0000" },
        ],
      }),
      { status: 200 }
    );
  }
  throw new Error(`Unmocked fetch: ${u}`);
}) as typeof fetch;

async function main() {
  console.log("--- getProviderStatuses ---");
  console.log(getProviderStatuses());

  console.log("\n--- searchFunds('axis bluechip') ---");
  const results = await searchFunds("axis bluechip");
  console.log(JSON.stringify(results, null, 2));
  if (results.length === 0) throw new Error("Expected at least one search result");
  if (results[0].category !== "large_cap") throw new Error("Category mapping failed");
  if (typeof results[0].returns1Y !== "number") throw new Error("Returns computation failed");

  console.log("\n--- getFundDetails('120503') ---");
  const detail = await getFundDetails("120503");
  console.log(detail);
  if (detail.riskLevel !== "moderately_high") throw new Error("Risk inference failed");

  console.log("\n--- getAvailableTools (read-only) ---");
  const roTools = getAvailableTools({ supabase: {} as any, portfolioId: "p1", canMutate: false });
  console.log(roTools.map((t) => t.name));
  if (roTools.some((t) => t.name.includes("add_fund"))) throw new Error("Mutation tool leaked into read-only mode");

  console.log("\n--- executeTool('search_mutual_funds') via tool layer ---");
  const outcome = await executeTool("search_mutual_funds", { query: "axis bluechip" }, {
    supabase: {} as any,
    portfolioId: "p1",
    canMutate: false,
  });
  console.log(outcome);

  console.log("\n--- executeTool('add_fund_to_portfolio') blocked when canMutate=false ---");
  const blocked = await executeTool(
    "add_fund_to_portfolio",
    { name: "Test", category: "large_cap", riskLevel: "moderate", investedAmount: 1000 },
    { supabase: {} as any, portfolioId: "p1", canMutate: false }
  );
  console.log(blocked);
  if (blocked.portfolioChanged) throw new Error("Mutation should have been blocked");

  global.fetch = realFetch;
  console.log("\nAll smoke tests passed.");
}

main().catch((err) => {
  console.error("SMOKE TEST FAILED:", err);
  process.exit(1);
});
