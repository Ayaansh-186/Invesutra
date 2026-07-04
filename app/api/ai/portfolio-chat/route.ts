// Copyright © 2026 Ayaansh Singhal. All Rights Reserved.

import { NextRequest, NextResponse } from "next/server";
import { answerPortfolioQuestion } from "@/lib/ai/portfolioAssistant";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Portfolio } from "@/lib/types";
import type { ToolExecutionContext } from "@/lib/ai/tools";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const portfolio = body.portfolio as Portfolio | undefined;
    const messages = body.messages;

    if (!portfolio || !Array.isArray(portfolio.funds)) {
      return NextResponse.json(
        { error: "Request body must include a portfolio with a funds array." },
        { status: 400 }
      );
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Request body must include at least one chat message." },
        { status: 400 }
      );
    }

    const safeMessages = messages
      .filter((message) => message && (message.role === "user" || message.role === "assistant"))
      .map((message) => ({
        role: message.role,
        content: String(message.content || "").slice(0, 1200),
      }))
      .filter((message) => message.content.trim().length > 0);

    if (safeMessages.length === 0) {
      return NextResponse.json({ error: "No valid messages supplied." }, { status: 400 });
    }

    // Only enable fund-mutation tools (add/update/remove) when the caller
    // is signed in AND actually owns a DB-backed portfolio matching the id
    // sent from the client. Demo/guest portfolios (not in the DB) and
    // portfolios the caller doesn't own stay read-only — the AI can still
    // search funds, it just can't write to anyone's holdings.
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let canMutate = false;
    if (user && portfolio.id) {
      const { data: owned } = await supabase
        .from("portfolios")
        .select("id")
        .eq("id", portfolio.id)
        .eq("user_id", user.id)
        .maybeSingle();
      canMutate = Boolean(owned);
    }

    const toolContext: ToolExecutionContext = {
      supabase,
      portfolioId: portfolio.id,
      canMutate,
    };

    const result = await answerPortfolioQuestion(portfolio, safeMessages, toolContext);

    // Persist chat history so it survives a full page reload / new session —
    // only for signed-in users on a portfolio they actually own (same
    // ownership check as canMutate above). Client resends the full running
    // conversation each request, so we only insert the newest user message
    // plus this turn's assistant answer, not the whole array again.
    if (canMutate && user) {
      const latestUserMessage = safeMessages[safeMessages.length - 1];
      const rows = [
        { portfolio_id: portfolio.id, user_id: user.id, role: "user" as const, content: latestUserMessage.content },
        { portfolio_id: portfolio.id, user_id: user.id, role: "assistant" as const, content: result.answer },
      ];
      const { error: chatSaveError } = await supabase.from("chat_messages").insert(rows);
      if (chatSaveError) {
        // Non-fatal — the assistant already answered. Most likely cause is
        // the chat_messages migration hasn't been run yet (see
        // supabase/migrations/002_chat_messages.sql).
        console.warn("Failed to persist chat message (has the chat_messages migration been run?):", chatSaveError.message);
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Portfolio chat route error:", error);
    return NextResponse.json({ error: error.message || "Assistant failed" }, { status: 500 });
  }
}
