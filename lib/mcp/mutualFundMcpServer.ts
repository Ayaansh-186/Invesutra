// Copyright © 2026 Ayaansh Singhal. All Rights Reserved.
//
// A real Model Context Protocol server (using @modelcontextprotocol/sdk)
// exposing Indian mutual fund search + fund detail tools, backed by AMFI
// data (see mutualFundSource.ts for why this is AMFI/mfapi.in and not raw
// Zerodha Kite data — Kite has no fund-screener API).
//
// This runs in-process today (see mcpClient.ts, which connects to it over
// an in-memory MCP transport), but it's a genuine MCP server: it speaks the
// standard tools/list + tools/call protocol. To move it out-of-process
// later (e.g. run it as its own hosted MCP server), swap the transport in
// mcpClient.ts for StreamableHTTPClientTransport pointed at
// MUTUAL_FUND_MCP_SERVER_URL — no changes needed here.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  computeReturns,
  getSchemeDetail,
  inferRiskLevel,
  mapAmfiCategory,
  searchSchemes,
} from "./mutualFundSource";

export function createMutualFundMcpServer(): McpServer {
  const server = new McpServer({
    name: "invesutra-mutual-fund-mcp",
    version: "1.0.0",
  });

  server.registerTool(
    "search_mutual_funds",
    {
      title: "Search Indian mutual funds",
      description:
        "Search Indian mutual fund schemes by name (e.g. 'HDFC Flexi Cap', 'Axis Bluechip Direct Growth'). " +
        "Returns scheme code, scheme name, and fund house for each match, sourced from AMFI's public NAV registry. " +
        "Call get_fund_details with a schemeCode from the results to get NAV, returns, category, and risk level.",
      inputSchema: {
        query: z.string().min(2).describe("Fund name or partial name to search for"),
        limit: z.number().int().min(1).max(20).optional().describe("Max results (default 8)"),
      },
    },
    async ({ query, limit }) => {
      const hits = await searchSchemes(query, limit ?? 8);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                provider: "amfi-mfapi",
                results: hits.map((h) => ({ schemeCode: h.schemeCode, name: h.schemeName })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_fund_details",
    {
      title: "Get mutual fund details",
      description:
        "Get NAV, trailing 1Y/3Y/5Y returns, category, and an approximate risk band for one mutual fund scheme by its " +
        "AMFI scheme code (from search_mutual_funds). Expense ratio and AUM are not available from this free data " +
        "source and are omitted rather than guessed.",
      inputSchema: {
        schemeCode: z.union([z.string(), z.number()]).describe("AMFI scheme code from search_mutual_funds"),
      },
    },
    async ({ schemeCode }) => {
      const detail = await getSchemeDetail(schemeCode);
      const category = mapAmfiCategory(detail.meta.scheme_category, detail.meta.scheme_name);
      const { latestNav, asOf, returns1Y, returns3Y, returns5Y } = computeReturns(detail.data);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                provider: "amfi-mfapi",
                schemeCode: detail.meta.scheme_code,
                name: detail.meta.scheme_name,
                fundHouse: detail.meta.fund_house,
                category,
                categoryRaw: detail.meta.scheme_category,
                riskLevel: inferRiskLevel(category),
                riskLevelNote: "Approximate, inferred from category — not a live SEBI riskometer feed.",
                nav: latestNav,
                navAsOf: asOf,
                returns1Y,
                returns3Y,
                returns5Y,
                expenseRatio: undefined,
                aum: undefined,
                dataNote: "Expense ratio and AUM are not published by this free data source.",
                isin: detail.meta.isin_growth ?? undefined,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}
