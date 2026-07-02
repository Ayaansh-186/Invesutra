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
    if (body[key] !== undefined) updates[dbKey] = body[key];
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
