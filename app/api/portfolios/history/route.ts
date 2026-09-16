// Copyright © 2026 Ayaansh Singhal. All Rights Reserved.

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Returns the most recent stored snapshots for a portfolio so the UI can show
 * "what changed since you were last here". Snapshots are written by
 * /api/ai/analyze; this is the read side.
 *
 * Query params:
 *   portfolioId (required)
 *   limit       (optional, default 30, max 90)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const portfolioId = searchParams.get("portfolioId");
    const limitParam = Number(searchParams.get("limit") || 30);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 90) : 30;

    if (!portfolioId) {
      return NextResponse.json({ error: "portfolioId is required." }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Not signed in (or Supabase unconfigured) — return an empty history
    // rather than an error, so the UI can simply render nothing.
    if (!user) {
      return NextResponse.json({ snapshots: [] });
    }

    // Confirm the caller actually owns this portfolio before returning
    // anything, alongside the RLS policy on the table itself.
    const { data: owned } = await supabase
      .from("portfolios")
      .select("id")
      .eq("id", portfolioId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!owned) {
      return NextResponse.json({ snapshots: [] });
    }

    const { data, error } = await supabase
      .from("analysis_history")
      .select("id, health_score, risk_score, diversification_score, total_value, total_invested, created_at")
      .eq("portfolio_id", portfolioId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ snapshots: [] });
    }

    return NextResponse.json({ snapshots: data ?? [] });
  } catch {
    // History is a progressive enhancement — never surface a hard failure.
    return NextResponse.json({ snapshots: [] });
  }
}

/**
 * Records a lightweight snapshot of the portfolio's current scores so the
 * "since your last visit" comparison has something to diff against on the
 * next visit.
 *
 * Throttled to at most one snapshot per 12 hours per portfolio — a page
 * visit must never be able to flood analysis_history.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { portfolioId, healthScore, riskScore, diversificationScore, totalValue, totalInvested } = body || {};

    if (!portfolioId || typeof healthScore !== "number" || typeof riskScore !== "number") {
      return NextResponse.json({ recorded: false }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ recorded: false });

    const { data: owned } = await supabase
      .from("portfolios")
      .select("id")
      .eq("id", portfolioId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!owned) return NextResponse.json({ recorded: false });

    // Throttle: skip if we already recorded within the last 12 hours.
    const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("analysis_history")
      .select("id")
      .eq("portfolio_id", portfolioId)
      .eq("user_id", user.id)
      .gte("created_at", cutoff)
      .limit(1);

    if (recent && recent.length > 0) {
      return NextResponse.json({ recorded: false, reason: "throttled" });
    }

    await supabase.from("analysis_history").insert({
      portfolio_id: portfolioId,
      user_id: user.id,
      health_score: Math.round(healthScore),
      risk_score: Math.round(riskScore),
      diversification_score: Math.round(diversificationScore ?? 0),
      total_value: totalValue ?? 0,
      total_invested: totalInvested ?? 0,
      snapshot: {},
    });

    return NextResponse.json({ recorded: true });
  } catch {
    return NextResponse.json({ recorded: false });
  }
}
