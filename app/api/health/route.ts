import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Diagnostic endpoint. Hit /api/health while developing locally to check,
 * in one place, whether OpenAI and Supabase are actually reachable and
 * correctly configured — instead of guessing from UI symptoms.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; detail: string }> = {};

  // --- AI provider (Groq -> Gemini -> OpenAI fallback chain) ---------------
  const configuredProviders = [
    process.env.GROQ_API_KEY && "groq",
    process.env.GEMINI_API_KEY && "gemini",
    process.env.OPENAI_API_KEY && "openai",
  ].filter(Boolean);

  if (configuredProviders.length === 0) {
    checks.ai = {
      ok: false,
      detail: "No AI provider configured. Set GROQ_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY.",
    };
  } else {
    try {
      const { getAIChatCompletion } = await import("@/lib/ai/aiClient");
      const { provider } = await getAIChatCompletion([{ role: "user", content: "ping" }]);
      checks.ai = {
        ok: true,
        detail: `Reachable via ${provider}. Configured: ${configuredProviders.join(", ")}.`,
      };
    } catch (error: any) {
      checks.ai = {
        ok: false,
        detail: `All configured providers (${configuredProviders.join(", ")}) failed: ${error?.message || "unknown error"}`,
      };
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
