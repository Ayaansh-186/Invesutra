import { Lock, Droplets, Target, ArrowUpRight, Bot } from "lucide-react";

const layers = [
  {
    icon: Lock,
    title: "Principal Layer",
    description: "Your original investment is maintained as a protected baseline. No rebalancing action ever reduces below the principal floor.",
    color: "border-cyan-200/60 bg-cyan-50/50",
    iconColor: "text-cyan-600",
    badge: "Protected",
    badgeColor: "bg-cyan-100 text-cyan-700",
  },
  {
    icon: ArrowUpRight,
    title: "Alpha Pool",
    description: "When portfolio returns exceed a defined milestone (e.g. 12%), the algorithm captures a portion of gains as secured alpha.",
    color: "border-emerald-200/60 bg-emerald-50/50",
    iconColor: "text-emerald-600",
    badge: "Extracted",
    badgeColor: "bg-emerald-100 text-emerald-700",
  },
  {
    icon: Target,
    title: "Milestone Triggers",
    description: "Rebalancing fires at predefined gain milestones (10%, 20%, 30%...). Systematic approach removes emotion from decisions.",
    color: "border-violet-200/60 bg-violet-50/50",
    iconColor: "text-violet-600",
    badge: "Systematic",
    badgeColor: "bg-violet-100 text-violet-700",
  },
  {
    icon: Droplets,
    title: "Dry Powder Reserve",
    description: "20% of captured alpha held as dry powder — liquid reserves deployed during market corrections to buy quality funds at a discount.",
    color: "border-amber-200/60 bg-amber-50/50",
    iconColor: "text-amber-600",
    badge: "Reserve",
    badgeColor: "bg-amber-100 text-amber-700",
  },
];

export default function AlgorithmSection() {
  return (
    <section id="algorithm" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
              <Bot className="h-3.5 w-3.5" />
              QuantRebalance Protocol
            </div>
            <h2 className="text-4xl font-semibold text-slate-900 tracking-tight leading-tight mb-5">
              Algorithmic rebalancing, explained by AI
            </h2>
            <p className="text-lg text-slate-500 leading-relaxed mb-6">
              The QuantRebalance Protocol (QRP) is a rules-based portfolio management algorithm. Ask Sutra AI to explain how it applies to your specific holdings and allocation.
            </p>
            <p className="text-sm text-slate-400 bg-slate-50 border border-slate-200 rounded-xl p-4 leading-relaxed">
              <strong className="text-slate-600">Disclaimer:</strong> Invesutra is a decision-support platform, not a guaranteed returns product.
              All analysis is based on historical data and algorithmic models. Past performance is not indicative of future results.
            </p>
          </div>

          <div className="space-y-4">
            {layers.map((layer) => (
              <div key={layer.title} className={`p-5 rounded-xl border ${layer.color} flex items-start gap-4 transition hover:shadow-sm`}>
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm shrink-0">
                  <layer.icon className={`w-5 h-5 ${layer.iconColor}`} strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-900 text-sm">{layer.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${layer.badgeColor}`}>{layer.badge}</span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{layer.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
