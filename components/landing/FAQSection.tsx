"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "Is Invesutra a SEBI-registered investment advisor?",
    a: "No. Invesutra is a decision-support and portfolio analysis platform, not a SEBI-registered investment advisor. Our AI-generated insights are for informational purposes only. Always consult a qualified registered investment advisor before making financial decisions.",
  },
  {
    q: "Does Invesutra guarantee returns?",
    a: "Absolutely not. Invesutra does not guarantee any returns. We provide data-driven analysis, risk assessment, and algorithmic rebalancing suggestions based on historical data and mathematical models. Past performance is not indicative of future results.",
  },
  {
    q: "Which AMCs and brokers are supported?",
    a: "You can manually enter holdings from any Indian AMC. We support all major AMCs including Mirae Asset, Axis, SBI, HDFC, ICICI Prudential, Nippon India, Kotak, and many more. Automatic import integrations are coming soon.",
  },
  {
    q: "What is the QuantRebalance Protocol?",
    a: "QRP is a rules-based portfolio management algorithm that systematically identifies gain-capture opportunities, triggers rebalancing at predefined milestones, protects principal capital, and maintains a dry powder reserve for market corrections. It removes emotion from rebalancing decisions.",
  },
  {
    q: "Is my portfolio data secure?",
    a: "Yes. All portfolio data is encrypted at rest and in transit. We use Supabase for secure data storage and never share your personal financial information with third parties. You can delete your data at any time.",
  },
  {
    q: "Can I use Invesutra for free?",
    a: "Yes. The Free plan allows you to analyze 1 portfolio with basic AI screening and up to 3 reports per month — no credit card required. Upgrade to Pro or Premium for unlimited portfolios, advanced analysis, and the full QuantRebalance engine.",
  },
];

export default function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 bg-white">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-sky-600 uppercase tracking-widest mb-3">FAQ</p>
          <h2 className="text-4xl font-bold text-slate-900 tracking-tight">Common questions</h2>
        </div>

        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors"
              >
                <span className="font-medium text-slate-900 text-sm leading-relaxed">{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 shrink-0 ml-4 transition-transform ${open === i ? "rotate-180" : ""}`}
                />
              </button>
              {open === i && (
                <div className="px-6 pb-4 text-sm text-slate-500 leading-relaxed">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
