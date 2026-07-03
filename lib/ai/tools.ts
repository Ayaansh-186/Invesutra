// Copyright © 2026 Ayaansh Singhal. All Rights Reserved.
//
// Tool (function-calling) definitions Sutra AI can invoke mid-conversation,
// plus the server-side executors bound to a specific authenticated user's
// portfolio. Two categories:
//
//  - Read-only fund data (search_mutual_funds, get_fund_details): backed by
//    the Mutual Fund MCP server (lib/mcp), always available.
//  - Portfolio mutation (add_fund_to_portfolio, update_fund_holding,
//    remove_fund_from_portfolio): write to Invesutra's own Supabase
//    tracker only. These never touch a real brokerage account — see
//    providers.ts for why real Zerodha order placement is out of scope.
//    Only enabled when `context.canMutate` is true (signed-in user with a
//    verified-owned, DB-backed portfolio).

import type { ToolDefinition } from "./aiClient";
import { searchFunds, getFundDetails } from "@/lib/marketData/providers";
import { fundToDbInsert, dbFundToFund } from "@/lib/supabase/mappers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DbFund } from "@/lib/supabase/database.types";
import type { FundCategory, RiskLevel } from "@/lib/types";

export interface ToolExecutionContext {
  supabase: SupabaseClient;
  portfolioId: string;
  /** False for demo/guest sessions or portfolios the caller doesn't own — mutation tools are hidden. */
  canMutate: boolean;
}

export const READ_ONLY_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "search_mutual_funds",
    description:
      "Search Indian mutual fund schemes by name via the Mutual Fund MCP server (AMFI data). Use this before " +
      "adding a fund so you have its real scheme code, category, NAV, and returns.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Fund name or partial name, e.g. 'HDFC Flexi Cap Direct Growth'" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_fund_details",
    description:
      "Get NAV, 1Y/3Y/5Y returns, category, and approximate risk level for one fund by its scheme code " +
      "(from search_mutual_funds' symbol field).",
    parameters: {
      type: "object",
      properties: {
        schemeCode: { type: "string", description: "AMFI scheme code" },
      },
      required: ["schemeCode"],
    },
  },
];

export const MUTATION_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "add_fund_to_portfolio",
    description:
      "Add a mutual fund holding to the user's Invesutra portfolio (their own tracked portfolio, not a real " +
      "brokerage order). Look up real data with search_mutual_funds/get_fund_details first when possible; if the " +
      "user gives you exact numbers, use those.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        category: {
          type: "string",
          enum: [
            "large_cap", "mid_cap", "small_cap", "multi_cap", "flexi_cap",
            "debt", "hybrid", "index", "sectoral", "elss", "international",
          ],
        },
        riskLevel: {
          type: "string",
          enum: ["low", "moderate", "moderately_high", "high", "very_high"],
        },
        investedAmount: { type: "number", description: "Total amount invested, in INR" },
        currentValue: { type: "number", description: "Current market value, in INR (defaults to investedAmount if unknown)" },
        nav: { type: "number" },
        units: { type: "number" },
        returns1Y: { type: "number" },
        returns3Y: { type: "number" },
        returns5Y: { type: "number" },
        expenseRatio: { type: "number" },
      },
      required: ["name", "category", "riskLevel", "investedAmount"],
    },
  },
  {
    name: "update_fund_holding",
    description: "Update fields on an existing fund holding in the user's portfolio (e.g. after a top-up or NAV refresh).",
    parameters: {
      type: "object",
      properties: {
        fundId: { type: "string", description: "The fund's id, from the portfolio data in this conversation" },
        investedAmount: { type: "number" },
        currentValue: { type: "number" },
        units: { type: "number" },
        nav: { type: "number" },
      },
      required: ["fundId"],
    },
  },
  {
    name: "remove_fund_from_portfolio",
    description: "Remove a fund holding from the user's portfolio. Confirm with the user before calling this.",
    parameters: {
      type: "object",
      properties: {
        fundId: { type: "string", description: "The fund's id, from the portfolio data in this conversation" },
      },
      required: ["fundId"],
    },
  },
];

export function getAvailableTools(context: ToolExecutionContext): ToolDefinition[] {
  return context.canMutate
    ? [...READ_ONLY_TOOL_DEFINITIONS, ...MUTATION_TOOL_DEFINITIONS]
    : READ_ONLY_TOOL_DEFINITIONS;
}

export interface ToolExecutionOutcome {
  result: unknown;
  portfolioChanged: boolean;
}

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionOutcome> {
  switch (toolName) {
    case "search_mutual_funds": {
      const results = await searchFunds(String(args.query || ""));
      return { result: { funds: results }, portfolioChanged: false };
    }

    case "get_fund_details": {
      const details = await getFundDetails(String(args.schemeCode || ""));
      return { result: details, portfolioChanged: false };
    }

    case "add_fund_to_portfolio": {
      if (!context.canMutate) {
        return {
          result: { error: "Sign in and select a saved portfolio to add funds through chat." },
          portfolioChanged: false,
        };
      }
      const investedAmount = Number(args.investedAmount);
      const payload = {
        name: String(args.name || "").slice(0, 200),
        category: args.category as FundCategory,
        riskLevel: args.riskLevel as RiskLevel,
        investedAmount,
        currentValue: args.currentValue !== undefined ? Number(args.currentValue) : investedAmount,
        nav: args.nav !== undefined ? Number(args.nav) : undefined,
        units: args.units !== undefined ? Number(args.units) : undefined,
        returns1Y: args.returns1Y !== undefined ? Number(args.returns1Y) : undefined,
        returns3Y: args.returns3Y !== undefined ? Number(args.returns3Y) : undefined,
        returns5Y: args.returns5Y !== undefined ? Number(args.returns5Y) : undefined,
        expenseRatio: args.expenseRatio !== undefined ? Number(args.expenseRatio) : undefined,
      };

      if (!payload.name || !payload.category || !payload.riskLevel || !Number.isFinite(investedAmount)) {
        return {
          result: { error: "name, category, riskLevel, and investedAmount are required." },
          portfolioChanged: false,
        };
      }

      const insertPayload = fundToDbInsert(payload, context.portfolioId);
      const { data, error } = await context.supabase.from("funds").insert(insertPayload).select().single();
      if (error) return { result: { error: error.message }, portfolioChanged: false };
      return { result: { fund: dbFundToFund(data as DbFund) }, portfolioChanged: true };
    }

    case "update_fund_holding": {
      if (!context.canMutate) {
        return { result: { error: "Sign in and select a saved portfolio to update funds through chat." }, portfolioChanged: false };
      }
      const fundId = String(args.fundId || "");
      if (!fundId) return { result: { error: "fundId is required." }, portfolioChanged: false };

      const updates: Record<string, unknown> = {};
      if (args.investedAmount !== undefined) updates.invested_amount = Number(args.investedAmount);
      if (args.currentValue !== undefined) updates.current_value = Number(args.currentValue);
      if (args.units !== undefined) updates.units = Number(args.units);
      if (args.nav !== undefined) updates.nav = Number(args.nav);

      if (Object.keys(updates).length === 0) {
        return { result: { error: "No valid fields to update." }, portfolioChanged: false };
      }

      // Ownership is enforced by the `funds` table's RLS policy (via the
      // parent portfolio's user_id), same as app/api/funds/[id]/route.ts.
      const { data, error } = await context.supabase.from("funds").update(updates).eq("id", fundId).select().maybeSingle();
      if (error) return { result: { error: error.message }, portfolioChanged: false };
      if (!data) return { result: { error: "Fund not found." }, portfolioChanged: false };
      return { result: { fund: dbFundToFund(data as DbFund) }, portfolioChanged: true };
    }

    case "remove_fund_from_portfolio": {
      if (!context.canMutate) {
        return { result: { error: "Sign in and select a saved portfolio to remove funds through chat." }, portfolioChanged: false };
      }
      const fundId = String(args.fundId || "");
      if (!fundId) return { result: { error: "fundId is required." }, portfolioChanged: false };

      const { data, error } = await context.supabase.from("funds").delete().eq("id", fundId).select().maybeSingle();
      if (error) return { result: { error: error.message }, portfolioChanged: false };
      if (!data) return { result: { error: "Fund not found." }, portfolioChanged: false };
      return { result: { success: true }, portfolioChanged: true };
    }

    default:
      return { result: { error: `Unknown tool: ${toolName}` }, portfolioChanged: false };
  }
}
