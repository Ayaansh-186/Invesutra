import Link from "next/link";
import { ArrowRight, MessageSquare, Sparkles } from "lucide-react";

export default function CTASection() {
  return (
    <section className="relative overflow-hidden bg-[#07111f] py-24">
      <div className="absolute inset-0 premium-grid opacity-20" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(103,232,249,0.12),transparent_50%)]" />

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
          <Sparkles className="h-3.5 w-3.5" />
          Free to start
        </div>
        <h2 className="text-balance text-4xl font-semibold tracking-tight text-white md:text-5xl">
          Start chatting with Sutra AI today
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-xl leading-relaxed text-slate-400">
          No credit card. No fluff — just clear, intelligent portfolio analysis powered by AI and the QuantRebalance Protocol.
        </p>
        <Link
          href="/dashboard"
          className="group mt-10 inline-flex items-center gap-2.5 rounded-xl bg-cyan-300 px-8 py-4 text-base font-semibold text-slate-950 transition hover:bg-cyan-200 ai-glow"
        >
          <MessageSquare className="h-5 w-5" />
          Open Sutra AI
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </Link>
        <p className="mt-4 text-sm text-slate-500">No account required to explore with sample data</p>
      </div>
    </section>
  );
}
