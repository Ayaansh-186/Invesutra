"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight, Bot, CheckCircle2, MessageSquare, Search,
  ShieldCheck, Sparkles, Send, TrendingUp, Zap,
} from "lucide-react";

const chatMessages = [
  { role: "user" as const, text: "Why is my portfolio risk score 68?" },
  { role: "assistant" as const, text: "Your small-cap allocation (22%) and sector overlap in two flexi-cap funds are pushing risk above your comfort band. Mid-cap exposure adds volatility." },
  { role: "user" as const, text: "What should I do first?" },
  { role: "assistant" as const, text: "Trim the most volatile satellite fund by 5–8% and redeploy toward your index or debt allocation. I can model the impact if you'd like." },
];

const metrics = [
  { label: "Health", value: "82", trend: "+4", color: "text-emerald-400" },
  { label: "Risk", value: "41", trend: "↓12", color: "text-cyan-300" },
  { label: "Returns", value: "+18.4%", trend: "YTD", color: "text-amber-300" },
];

const allocation = [
  { label: "Large cap", width: "44%", color: "bg-cyan-400" },
  { label: "Flexi cap", width: "24%", color: "bg-emerald-400" },
  { label: "Debt", width: "18%", color: "bg-violet-400" },
  { label: "Small cap", width: "14%", color: "bg-rose-400" },
];

export default function HeroSection() {
  const router = useRouter();
  const [visibleMessages, setVisibleMessages] = useState(0);
  const [askQuery, setAskQuery] = useState("");

  function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    const q = askQuery.trim();
    router.push(q ? `/dashboard?q=${encodeURIComponent(q)}` : "/dashboard");
  }

  useEffect(() => {
    if (visibleMessages >= chatMessages.length) return;
    const timer = setTimeout(() => setVisibleMessages((v) => v + 1), 900);
    return () => clearTimeout(timer);
  }, [visibleMessages]);

  return (
    <section className="relative overflow-hidden bg-[#07111f] pt-24 text-white">
      <div className="absolute inset-0 premium-grid opacity-40" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(103,232,249,0.2),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(52,211,153,0.15),transparent_25%),radial-gradient(circle_at_50%_80%,rgba(167,139,250,0.08),transparent_40%)]" />
      <div className="absolute top-32 left-1/4 w-72 h-72 rounded-full bg-cyan-500/10 blur-3xl animate-glow-pulse" />
      <div className="absolute top-48 right-1/4 w-96 h-96 rounded-full bg-emerald-500/8 blur-3xl animate-glow-pulse" style={{ animationDelay: "1.5s" }} />

      <div className="relative mx-auto max-w-7xl px-6 pb-10">
        <div className="grid min-h-[calc(100vh-96px)] items-center gap-12 lg:grid-cols-[0.88fr_1.12fr]">
          <div className="max-w-3xl py-12">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-200">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              AI-first mutual fund intelligence
            </div>

            <h1 className="text-balance text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl">
              Your portfolio,{" "}
              <span className="gradient-text">understood by AI</span>
            </h1>
            <p className="mt-6 max-w-2xl text-xl leading-8 text-slate-300">
              Invesutra is an investment copilot for Indian mutual fund investors. Chat with Invesutra AI to analyze holdings, understand risk, and get actionable rebalancing guidance — grounded in your real portfolio data.
            </p>

            <form onSubmit={handleAsk} className="relative mt-8 max-w-xl">
              <input
                value={askQuery}
                onChange={(e) => setAskQuery(e.target.value)}
                placeholder="Ask Invesutra: 'Is my portfolio too risky?'"
                className="w-full rounded-2xl border border-white/15 bg-white/[0.06] py-4 pl-5 pr-14 text-sm text-white shadow-lg outline-none backdrop-blur placeholder:text-slate-400 transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
              />
              <button
                type="submit"
                className="absolute right-2.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-cyan-300 text-slate-950 transition hover:bg-cyan-200"
                aria-label="Ask Invesutra AI"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 ai-glow"
              >
                <MessageSquare className="h-4 w-4" />
                Start chatting with Invesutra AI
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/screener"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <Search className="h-4 w-4" />
                Explore funds
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-400">
              {[
                "Portfolio analysis in plain English",
                "No invented market data",
                "Built for Indian AMCs",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative pb-12 lg:pb-0">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/90 shadow-2xl shadow-black/50 backdrop-blur ai-glow">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-emerald-400 text-slate-950">
                    <Bot className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Invesutra AI</p>
                    <p className="text-xs text-slate-400">Invesutra portfolio copilot</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  <span className="text-xs font-medium text-emerald-300">Live</span>
                </div>
              </div>

              <div className="grid gap-3 p-4 md:grid-cols-3">
                {metrics.map((m) => (
                  <div key={m.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{m.label}</p>
                    <p className={`mt-1 text-2xl font-semibold ${m.color}`}>{m.value}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">{m.trend}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-3 px-4 pb-4">
                {chatMessages.slice(0, visibleMessages).map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-2.5 animate-fade-up ${msg.role === "user" ? "justify-end" : ""}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-cyan-400/20">
                        <Sparkles className="h-3 w-3 text-cyan-300" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                        msg.role === "user"
                          ? "bg-white/10 text-slate-200"
                          : "border border-white/10 bg-white/[0.04] text-slate-300"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-white/10 px-4 py-3">
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                  <input
                    readOnly
                    placeholder="Ask Invesutra about your portfolio..."
                    className="flex-1 bg-transparent text-xs text-slate-400 outline-none placeholder:text-slate-600"
                  />
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-400 text-slate-950">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-300">Allocation</p>
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <div className="space-y-2.5">
                  {allocation.map((item) => (
                    <div key={item.label}>
                      <div className="mb-1 flex justify-between text-[10px] text-slate-500">
                        <span>{item.label}</span>
                        <span>{item.width}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className={`h-full rounded-full ${item.color}`} style={{ width: item.width }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  Grounded on your holdings
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Zap className="h-4 w-4 text-cyan-400" />
                  QuantRebalance engine
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Bot className="h-4 w-4 text-violet-400" />
                  AI-powered explanations
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative -mb-8 grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 text-slate-900 shadow-xl md:grid-cols-4">
          {[
            ["Chat", "Ask anything about your portfolio"],
            ["Analyze", "Health, risk, and fund-level insights"],
            ["Act", "Rebalancing and fund management"],
            ["Trust", "No hype — explainable decisions"],
          ].map(([title, body]) => (
            <div key={title} className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
