import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { dbFundToFund, fundToDbInsert } from "@/lib/supabase/mappers";
import type { DbFund } from "@/lib/supabase/database.types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function assertOwnsPortfolio(supabase: any, portfolioId: string, userId: string) {
  const { data } = await supabase
    .from("portfolios")
    .select("id")
    .eq("id", portfolioId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  if (!(await assertOwnsPortfolio(supabase, id, user.id))) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const { data, error } = await supabase.from("funds").select("*").eq("portfolio_id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const funds = ((data || []) as DbFund[]).map(dbFundToFund);
  return NextResponse.json({ funds });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  if (!(await assertOwnsPortfolio(supabase, id, user.id))) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const body = await request.json();

  if (!body.name || !body.category || !body.riskLevel) {
    return NextResponse.json(
      { error: "Fund requires at least name, category, and riskLevel" },
      { status: 400 }
    );
  }

  const insertPayload = fundToDbInsert(body, id);

  const { data, error } = await supabase.from("funds").insert(insertPayload).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ fund: dbFundToFund(data as DbFund) });
}
