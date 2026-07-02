import Link from "next/link";
import { Check, Sparkles } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "₹0",
    period: "forever",
    description: "For individual investors getting started.",
    features: [
      "1 portfolio",
      "Basic AI portfolio screening",
      "Portfolio health score",
      "3 AI reports per month",
      "Category allocation analysis",
    ],
    cta: "Get started free",
    href: "/dashboard",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "₹749",
    period: "per month",
    description: "For serious investors who want full intelligence.",
    features: [
      "Unlimited portfolios",
      "Advanced AI analysis",
      "QuantRebalance engine",
      "Portfolio simulator",
      "Unlimited AI reports",
      "Underperformer detection",
      "Risk concentration alerts",
      "Priority support",
    ],
    cta: "Start Pro trial",
    href: "/dashboard",
    highlighted: true,
    badge: "Most popular",
  },
  {
    name: "Premium",
    price: "₹2,299",
    period: "per month",
    description: "For wealth managers and power investors.",
    features: [
      "Everything in Pro",
      "Advanced risk analytics",
      "Custom milestone triggers",
      "PDF export for advisors",
      "Portfolio comparison",
      "Deeper market insights",
      "Dedicated account manager",
      "API access (coming soon)",
    ],
    cta: "Start Premium trial",
    href: "/dashboard",
    highlighted: false,
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-sky-600 uppercase tracking-widest mb-3">Pricing</p>
          <h2 className="text-4xl font-bold text-slate-900 tracking-tight">Simple, transparent pricing</h2>
          <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
            Start free. Upgrade when your portfolio does.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-8 flex flex-col ${
                plan.highlighted
                  ? "bg-slate-900 text-white shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900"
                  : "bg-white border border-slate-200"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="flex items-center gap-1 px-3 py-1 bg-sky-500 text-white text-xs font-semibold rounded-full shadow-sm">
                    <Sparkles className="w-3 h-3" />
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <p className={`text-sm font-semibold mb-1 ${plan.highlighted ? "text-slate-400" : "text-slate-500"}`}>
                  {plan.name}
                </p>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className={`text-4xl font-bold ${plan.highlighted ? "text-white" : "text-slate-900"}`}>
                    {plan.price}
                  </span>
                  <span className={`text-sm ${plan.highlighted ? "text-slate-400" : "text-slate-500"}`}>/{plan.period}</span>
                </div>
                <p className={`text-sm ${plan.highlighted ? "text-slate-400" : "text-slate-500"}`}>{plan.description}</p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5 text-sm">
                    <Check className={`w-4 h-4 shrink-0 ${plan.highlighted ? "text-sky-400" : "text-emerald-500"}`} strokeWidth={2.5} />
                    <span className={plan.highlighted ? "text-slate-300" : "text-slate-600"}>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`block text-center py-3 rounded-xl text-sm font-semibold transition-all ${
                  plan.highlighted
                    ? "bg-sky-500 text-white hover:bg-sky-400"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
