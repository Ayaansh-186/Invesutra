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
  const name = String(body.name || "").trim();
  const investedAmount = Number(body.investedAmount);
  const currentValue = body.currentValue === undefined ? investedAmount : Number(body.currentValue);

  if (!name || !body.category || !body.riskLevel) {
    return NextResponse.json(
      { error: "Fund requires at least name, category, and riskLevel" },
      { status: 400 }
    );
  }

  if (!Number.isFinite(investedAmount) || investedAmount <= 0) {
    return NextResponse.json({ error: "Invested amount must be greater than 0." }, { status: 400 });
  }

  if (!Number.isFinite(currentValue) || currentValue < 0) {
    return NextResponse.json({ error: "Current value must be 0 or greater." }, { status: 400 });
  }

  const { data: existingFunds } = await supabase
    .from("funds")
    .select("id, name")
    .eq("portfolio_id", id);
  const duplicate = (existingFunds as { id: string; name: string }[] | null)?.find(
    (fund) => fund.name.trim().toLowerCase() === name.toLowerCase()
  );
  if (duplicate) {
    return NextResponse.json({ error: `A fund named "${duplicate.name}" already exists in this portfolio.` }, { status: 409 });
  }

  const insertPayload = fundToDbInsert({ ...body, name, investedAmount, currentValue }, id);

  const { data, error } = await supabase.from("funds").insert(insertPayload).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ fund: dbFundToFund(data as DbFund) });
}
