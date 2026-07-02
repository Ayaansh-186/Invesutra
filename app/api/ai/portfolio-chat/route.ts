import { NextRequest, NextResponse } from "next/server";
import { answerPortfolioQuestion } from "@/lib/ai/portfolioAssistant";
import type { Portfolio } from "@/lib/types";

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

    const result = await answerPortfolioQuestion(portfolio, safeMessages);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Portfolio chat route error:", error);
    return NextResponse.json({ error: error.message || "Assistant failed" }, { status: 500 });
  }
}
