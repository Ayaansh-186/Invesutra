// Copyright © 2026 Ayaansh Singhal. All Rights Reserved.

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { DbChatMessage } from "@/lib/supabase/database.types";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: portfolioId } = await params;

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    // Ownership check mirrors app/api/ai/portfolio-chat/route.ts — RLS also
    // enforces this, but returning 403 explicitly gives a clearer error
    // than an empty result set for a portfolio that isn't theirs.
    const { data: owned } = await supabase
      .from("portfolios")
      .select("id")
      .eq("id", portfolioId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!owned) {
      return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("portfolio_id", portfolioId)
      .order("created_at", { ascending: true });

    if (error) {
      // Most likely cause: the chat_messages migration hasn't been run yet.
      // Fail soft — the UI falls back to a fresh greeting rather than breaking.
      console.warn("Failed to load chat history (has supabase/migrations/002_chat_messages.sql been run?):", error.message);
      return NextResponse.json({ messages: [] });
    }

    const messages = (data as Pick<DbChatMessage, "role" | "content" | "created_at">[]).map((row) => ({
      role: row.role,
      content: row.content,
    }));

    return NextResponse.json({ messages });
  } catch (error: any) {
    console.error("Chat history route error:", error);
    return NextResponse.json({ messages: [] });
  }
}
