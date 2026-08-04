import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getStripe } from "@/lib/stripe";
import { getMembershipTier } from "@/lib/membershipTiers";
import { getMembershipPriceId } from "@/lib/membershipStripePrices";

type PatientRow = { email: string };

// Creates a Stripe Checkout Session for a membership tier -- "monthly"
// starts a real subscription (mode: subscription), any other option is one
// of that tier's upfront prices (mode: payment), exactly like the shop's
// own checkout-session route, just against real Stripe Prices rather than
// price_data, since a recurring price has to be a real Price object. The
// option is validated against membershipTiers.ts and resolved to a Price
// id server-side -- the client only ever sends a tier id and an option key,
// never a price.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { tierId, option } = body as { tierId?: string; option?: string };
  if (!tierId || !option) {
    return NextResponse.json({ error: "tierId and option are required." }, { status: 400 });
  }

  const tier = getMembershipTier(tierId);
  if (!tier) {
    return NextResponse.json({ error: "Unknown membership tier." }, { status: 404 });
  }

  const isMonthly = option === "monthly";
  const upfrontOption = isMonthly ? null : tier.upfrontOptions.find((o) => o.key === option);
  if (!isMonthly && !upfrontOption) {
    return NextResponse.json({ error: "Unknown pricing option for this tier." }, { status: 404 });
  }

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("email")
    .eq("id", user.id)
    .maybeSingle<PatientRow>();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://athena-online-kappa.vercel.app";
  const membershipUrl = `${appUrl}/membership`;

  try {
    const priceId = getMembershipPriceId(tier.id, option);
    const session = await getStripe().checkout.sessions.create({
      mode: isMonthly ? "subscription" : "payment",
      customer_email: patient?.email ?? user.email,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        type: "membership",
        patient_id: user.id,
        tier: tier.id,
        billing_type: isMonthly ? "recurring" : "prepay",
        ...(upfrontOption ? { months: String(upfrontOption.months) } : {}),
      },
      success_url: `${membershipUrl}?purchase=success`,
      cancel_url: `${membershipUrl}?purchase=cancelled`,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a Checkout URL.");
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("membership checkout session create failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
