import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Diagnostic endpoint. Hit /api/health while developing locally to check,
 * in one place, whether OpenAI and Supabase are actually reachable and
 * correctly configured — instead of guessing from UI symptoms.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; detail: string }> = {};

  // --- OpenAI --------------------------------------------------------------
  if (!process.env.OPENAI_API_KEY) {
    checks.openai = { ok: false, detail: "OPENAI_API_KEY is not set." };
  } else {
    try {
      const { getOpenAIClient, OPENAI_MODEL } = await import("@/lib/ai/openaiClient");
      const openai = getOpenAIClient();
      await openai.chat.completions.create({
        model: OPENAI_MODEL,
        max_tokens: 5,
        messages: [{ role: "user", content: "ping" }],
      });
      checks.openai = { ok: true, detail: `Reachable, model=${OPENAI_MODEL}` };
    } catch (error: any) {
      checks.openai = { ok: false, detail: error?.message || "OpenAI request failed." };
    }
  }

  // --- Supabase --------------------------------------------------------------
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    checks.supabase = { ok: false, detail: "Supabase URL/anon key not set." };
  } else {
    try {
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase.from("portfolios").select("id", { count: "exact", head: true });
      if (error) {
        checks.supabase = { ok: false, detail: `${error.code || ""} ${error.message}`.trim() };
      } else {
        checks.supabase = { ok: true, detail: "portfolios table reachable." };
      }
    } catch (error: any) {
      checks.supabase = { ok: false, detail: error?.message || "Supabase request failed." };
    }
  }

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    { status: allOk ? "ok" : "degraded", app: "Invesutra", checks },
    { status: allOk ? 200 : 200 }
  );
}
