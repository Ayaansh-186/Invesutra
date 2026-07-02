import { NextRequest, NextResponse } from "next/server";
import { getStripe, PLANS, type PlanId } from "@/lib/stripe/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const planId = body.planId as PlanId;

    if (!planId || !["pro", "premium"].includes(planId)) {
      return NextResponse.json({ error: "Invalid plan selected" }, { status: 400 });
    }

    const plan = PLANS[planId];
    if (!plan.priceId) {
      return NextResponse.json(
        {
          error:
            "This plan is not yet configured with a Stripe Price ID. Set STRIPE_PRICE_ID_PRO / STRIPE_PRICE_ID_PREMIUM in your environment.",
        },
        { status: 500 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "You must be signed in to upgrade." }, { status: 401 });
    }

    const stripe = getStripe();
    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: plan.priceId, quantity: 1 }],
      customer_email: user.email ?? undefined,
      client_reference_id: user.id,
      success_url: `${origin}/dashboard?upgraded=true`,
      cancel_url: `${origin}/pricing?cancelled=true`,
      metadata: {
        userId: user.id,
        planId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
