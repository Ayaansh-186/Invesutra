"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import { useAuth } from "@/lib/hooks/useAuth";
import { Check, Sparkles, Loader2 } from "lucide-react";
import type { PlanId } from "@/lib/stripe/config";

const plans: Array<{
  id: PlanId;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  badge?: string;
  highlighted: boolean;
}> = [
  {
    id: "free",
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
    highlighted: false,
  },
  {
    id: "pro",
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
    highlighted: true,
    badge: "Most popular",
  },
  {
    id: "premium",
    name: "Premium",
    price: "₹2,299",
    period: "per month",
    description: "For wealth managers and power investors.",
    features: [
      "Everything in Pro",
      "Advanced risk analytics",
      "Custom milestone triggers",
      "Report export for advisors",
      "Portfolio comparison",
      "Deeper market insights",
      "Dedicated account manager",
      "API access (coming soon)",
    ],
    highlighted: false,
  },
];

export default function PricingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelectPlan(planId: PlanId) {
    setError(null);

    if (planId === "free") {
      router.push(user ? "/dashboard" : "/auth/signup");
      return;
    }

    if (!user) {
      router.push(`/auth/signup?plan=${planId}`);
      return;
    }

    setLoadingPlan(planId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong starting checkout.");
        setLoadingPlan(null);
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Could not reach the checkout service. Please try again.");
      setLoadingPlan(null);
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <Navbar />

      <section className="pt-32 pb-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-sky-600 uppercase tracking-widest mb-3">Pricing</p>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
              Simple, transparent pricing
            </h1>
            <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
              Start free. Upgrade when your portfolio does. Cancel anytime.
            </p>
          </div>

          {error && (
            <div className="max-w-md mx-auto mb-8 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 text-center">
              {error}
            </div>
          )}

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
                    <span className={`text-sm ${plan.highlighted ? "text-slate-400" : "text-slate-500"}`}>
                      /{plan.period}
                    </span>
                  </div>
                  <p className={`text-sm ${plan.highlighted ? "text-slate-400" : "text-slate-500"}`}>
                    {plan.description}
                  </p>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5 text-sm">
                      <Check
                        className={`w-4 h-4 shrink-0 ${plan.highlighted ? "text-sky-400" : "text-emerald-500"}`}
                        strokeWidth={2.5}
                      />
                      <span className={plan.highlighted ? "text-slate-300" : "text-slate-600"}>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={loadingPlan === plan.id || authLoading}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 ${
                    plan.highlighted
                      ? "bg-sky-500 text-white hover:bg-sky-400"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  {loadingPlan === plan.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  {plan.id === "free"
                    ? "Get started free"
                    : loadingPlan === plan.id
                    ? "Redirecting..."
                    : `Start ${plan.name} trial`}
                </button>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-slate-400 mt-10">
            Prices in INR. Taxes may apply. Need an invoice or annual billing?{" "}
            <Link href="mailto:support@invesutra.ai" className="text-sky-600 hover:underline">
              Contact us
            </Link>
            .
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
