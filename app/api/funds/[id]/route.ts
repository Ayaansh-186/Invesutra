import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { dbFundToFund } from "@/lib/supabase/mappers";
import type { DbFund } from "@/lib/supabase/database.types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Ownership is enforced via Row Level Security (the `funds` table policy
 * checks the parent portfolio's `user_id`), so a plain `.eq("id", id)`
 * update/delete from an authenticated client will simply affect 0 rows if
 * the caller doesn't own the fund. We still double-check the result below
 * to return a clean 404 rather than a silent no-op.
 */

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  // Fields that must be a finite, non-negative number if provided. money/
  // ratio fields only — returns are handled separately since they can
  // legitimately be negative.
  const nonNegativeNumberFields = new Set([
    "investedAmount",
    "currentValue",
    "nav",
    "units",
    "expenseRatio",
    "aum",
  ]);
  const returnFields = new Set(["returns1Y", "returns3Y", "returns5Y"]);
  const validCategories = new Set([
    "large_cap", "mid_cap", "small_cap", "multi_cap", "flexi_cap",
    "debt", "hybrid", "index", "sectoral", "elss", "international",
  ]);
  const validRiskLevels = new Set(["low", "moderate", "moderately_high", "high", "very_high"]);

  const fieldMap: Record<string, string> = {
    name: "name",
    category: "category",
    investedAmount: "invested_amount",
    currentValue: "current_value",
    nav: "nav",
    units: "units",
    returns1Y: "returns_1y",
    returns3Y: "returns_3y",
    returns5Y: "returns_5y",
    riskLevel: "risk_level",
    expenseRatio: "expense_ratio",
    aum: "aum",
    benchmark: "benchmark",
    manager: "manager",
  };

  for (const [key, dbKey] of Object.entries(fieldMap)) {
    if (body[key] === undefined) continue;

    if (nonNegativeNumberFields.has(key)) {
      const num = Number(body[key]);
      if (!Number.isFinite(num) || num < 0) {
        return NextResponse.json({ error: `${key} must be a number of 0 or greater.` }, { status: 400 });
      }
      updates[dbKey] = num;
    } else if (returnFields.has(key)) {
      const num = Number(body[key]);
      if (!Number.isFinite(num)) {
        return NextResponse.json({ error: `${key} must be a valid number.` }, { status: 400 });
      }
      updates[dbKey] = num;
    } else if (key === "name") {
      const name = String(body.name).trim();
      if (!name) {
        return NextResponse.json({ error: "Fund name cannot be empty." }, { status: 400 });
      }
      updates[dbKey] = name;
    } else if (key === "category") {
      if (!validCategories.has(body.category)) {
        return NextResponse.json({ error: "Invalid fund category." }, { status: 400 });
      }
      updates[dbKey] = body.category;
    } else if (key === "riskLevel") {
      if (!validRiskLevels.has(body.riskLevel)) {
        return NextResponse.json({ error: "Invalid risk level." }, { status: 400 });
      }
      updates[dbKey] = body.riskLevel;
    } else {
      updates[dbKey] = body[key];
    }
  }

  // investedAmount specifically can't be 0 (would zero out the denominator
  // in every % return / weight calculation downstream) — the create route
  // already enforces this; the edit route needs the same rule.
  if (typeof updates.invested_amount === "number" && updates.invested_amount === 0) {
    return NextResponse.json({ error: "Invested amount must be greater than 0." }, { status: 400 });
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase.from("funds").update(updates).eq("id", id).select().maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Fund not found" }, { status: 404 });
  }

  return NextResponse.json({ fund: dbFundToFund(data as DbFund) });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data, error } = await supabase.from("funds").delete().eq("id", id).select().maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Fund not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
