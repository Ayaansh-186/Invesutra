import { Bot, DatabaseZap, FileText, Gauge, MessageSquareText, ShieldAlert, SlidersHorizontal } from "lucide-react";

const features = [
  {
    icon: MessageSquareText,
    title: "Conversational portfolio copilot",
    description: "Chat with Invesutra AI to understand why risk moved, which funds drag performance, or how to rebalance — grounded in your holdings.",
  },
  {
    icon: Gauge,
    title: "Explainable health score",
    description: "Every score decomposes into diversification, concentration, volatility, drawdown, and performance signals you can ask about.",
  },
  {
    icon: ShieldAlert,
    title: "Risk concentration alerts",
    description: "Flags small-cap, mid-cap, sectoral, and category overexposure before it quietly dominates your portfolio.",
  },
  {
    icon: SlidersHorizontal,
    title: "Rebalancing logic",
    description: "Turns findings into practical allocation moves using the QuantRebalance engine — ask Invesutra to explain each suggestion.",
  },
  {
    icon: DatabaseZap,
    title: "Market-data ready architecture",
    description: "A provider layer ready for real Zerodha, Yahoo Finance, or mutual fund data adapters without fake results.",
  },
  {
    icon: FileText,
    title: "Reports and audit trail",
    description: "Analysis saved into Supabase history and convertible into reports for review or advisor conversations.",
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="bg-slate-50 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
            <Bot className="h-3.5 w-3.5" />
            AI is the product
          </div>
          <h2 className="text-balance text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            Built around questions investors actually ask.
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
            Like Multibagg AI, Invesutra puts conversation at the center — deterministic portfolio math with AI narration, so users get clear explanations without made-up market claims.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#07111f] text-cyan-300 transition group-hover:bg-gradient-to-br group-hover:from-cyan-400 group-hover:to-emerald-400 group-hover:text-slate-950">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-950">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
