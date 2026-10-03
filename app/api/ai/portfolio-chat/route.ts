// Copyright © 2026 Ayaansh Singhal. All Rights Reserved.

import { NextRequest, NextResponse } from "next/server";
import { answerPortfolioQuestion } from "@/lib/ai/portfolioAssistant";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildPortfolio, type DbPurchase } from "@/lib/supabase/mappers";
import { hydratePortfolioValuations } from "@/lib/marketData/valuation";
import type { Portfolio } from "@/lib/types";
import type { DbFund, DbPortfolio } from "@/lib/supabase/database.types";
import type { ToolExecutionContext } from "@/lib/ai/tools";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { hasDetailedAIConsent } from "@/lib/ai/privacy";

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(request, "portfolio-chat", 20, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many messages. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  try {
    const body = await request.json();
    const clientPortfolio = body.portfolio as Portfolio | undefined;
    const messages = body.messages;

    if (!clientPortfolio || !Array.isArray(clientPortfolio.funds)) {
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

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let portfolio = clientPortfolio;
    let hasOwnedPortfolio = false;
    if (user) {
      if (!clientPortfolio.id) {
        return NextResponse.json({ error: "Select a saved portfolio before asking about your holdings." }, { status: 400 });
      }
      const { data: owned, error: portfolioError } = await supabase
        .from("portfolios")
        .select("*")
        .eq("id", clientPortfolio.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (portfolioError) throw portfolioError;
      if (!owned) return NextResponse.json({ error: "Saved portfolio not found." }, { status: 404 });

      const { data: funds, error: fundsError } = await supabase
        .from("funds")
        .select("*")
        .eq("portfolio_id", clientPortfolio.id);
      if (fundsError) throw fundsError;
      const { data: purchases, error: purchaseError } = await supabase.from("transactions")
        .select("id, fund_id, created_at, nav, notes, units, amount").eq("portfolio_id", clientPortfolio.id).eq("type", "buy");
      if (purchaseError) throw purchaseError;
      portfolio = await hydratePortfolioValuations(buildPortfolio(owned as DbPortfolio, (funds || []) as DbFund[], (purchases || []) as DbPurchase[]));
      hasOwnedPortfolio = true;
    }

    const toolContext: ToolExecutionContext = {
      supabase,
      portfolioId: portfolio.id,
      canMutate: false,
      isSignedIn: hasOwnedPortfolio,
    };

    const result = await answerPortfolioQuestion(portfolio, safeMessages, toolContext, {
      allowPrivateAI: body.allowPrivateAI === true,
      allowDetailedPrivateAI: hasDetailedAIConsent(body),
    });

    // Persist chat history so it survives a full page reload / new session.
    // Client resends the full running
    // conversation each request, so we only insert the newest user message
    // plus this turn's assistant answer, not the whole array again.
    if (hasOwnedPortfolio && user) {
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
