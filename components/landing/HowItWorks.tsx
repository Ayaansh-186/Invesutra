import { Bot, BrainCircuit, Layers3, MessageCircleQuestion, SearchCheck } from "lucide-react";

const steps = [
  {
    icon: Layers3,
    title: "Connect or create a portfolio",
    description: "Start with existing holdings, sample data, or ask Invesutra to help you add funds manually.",
  },
  {
    icon: BrainCircuit,
    title: "Run deterministic analysis",
    description: "The engine calculates allocation, health, risk, drawdown, beta, and concentration warnings instantly.",
  },
  {
    icon: MessageCircleQuestion,
    title: "Chat with Invesutra AI",
    description: "Ask anything — the assistant explains why the numbers look the way they do and what to review first.",
  },
  {
    icon: SearchCheck,
    title: "Act on insights",
    description: "Add funds, explore the screener, or run simulations — all from a single AI-first workflow.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <Bot className="h-3.5 w-3.5" />
              How Invesutra works
            </div>
            <h2 className="text-balance text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              From holdings to an intelligent conversation.
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              The dashboard is built around chat. Portfolio widgets sit beside Invesutra AI so you always have context while you ask questions.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-6 transition hover:border-cyan-200 hover:bg-white"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#07111f] text-cyan-300 shadow-sm">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-semibold text-slate-300">0{index + 1}</span>
                </div>
                <h3 className="mt-5 text-base font-semibold text-slate-950">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
