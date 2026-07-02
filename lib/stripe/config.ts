import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

// Lazily instantiate so the app can still build/run without keys configured locally.
export function getStripe(): Stripe {
  if (!stripeSecretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to your environment to enable Stripe checkout."
    );
  }
  return new Stripe(stripeSecretKey, {
    apiVersion: "2026-06-24.dahlia",
  });
}

export type PlanId = "free" | "pro" | "premium";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  priceInr: number;
  priceId?: string; // Stripe Price ID, set via env vars
  interval: "month";
  features: string[];
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    priceInr: 0,
    interval: "month",
    features: [
      "1 portfolio",
      "Basic AI portfolio screening",
      "Portfolio health score",
      "3 AI reports per month",
      "Category allocation analysis",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceInr: 749,
    priceId: process.env.STRIPE_PRICE_ID_PRO,
    interval: "month",
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
  },
  premium: {
    id: "premium",
    name: "Premium",
    priceInr: 2299,
    priceId: process.env.STRIPE_PRICE_ID_PREMIUM,
    interval: "month",
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
  },
};
