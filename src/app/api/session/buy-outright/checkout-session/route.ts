import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getStripe } from "@/lib/stripe";

const PRICE_GBP = 39;

type ProgrammeRow = { id: string; title: string; source: "subscription_gated" | "owned" | "clinician_assigned" };
type PatientRow = { email: string };

// "Keep it forever" -- a one-off £39 purchase of a programme the patient
// already has, exactly the same Checkout pipeline as the shop (hosted
// page, cooling-off waiver, webhook-driven fulfilment only after Stripe
// confirms payment). The difference from a shop purchase is what it's
// for: no template, no new programme created -- this marks the patient's
// own existing programme as owned outright.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { programmeId } = body as { programmeId?: string };
  if (!programmeId) {
    return NextResponse.json({ error: "programmeId is required." }, { status: 400 });
  }

  // Runs under the patient's own login -- RLS guarantees this only ever
  // resolves if the programme genuinely belongs to them, same ownership
  // check as /session/[programmeId]/page.tsx.
  const { data: programme } = await supabase
    .from("programmes")
    .select("id, title, source")
    .eq("id", programmeId)
    .eq("patient_id", user.id)
    .maybeSingle<ProgrammeRow>();
  if (!programme) {
    return NextResponse.json({ error: "Programme not found." }, { status: 404 });
  }
  if (programme.source === "owned") {
    return NextResponse.json({ error: "You already own this programme outright." }, { status: 400 });
  }

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("email")
    .eq("id", user.id)
    .maybeSingle<PatientRow>();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://athena-online-kappa.vercel.app";
  const programmeUrl = `${appUrl}/session/${programmeId}`;

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: patient?.email ?? user.email,
      client_reference_id: user.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: PRICE_GBP * 100,
            product_data: {
              name: `${programme.title}, keep it forever`,
              description: "One-off purchase. This programme is yours to keep, no expiry, no subscription.",
            },
          },
        },
      ],
      metadata: {
        type: "buy_outright",
        patient_id: user.id,
        programme_id: programme.id,
        programme_title: programme.title,
      },
      // Same reasoning as the shop's own checkout session -- immediate
      // access to a digital service, so the 14-day cooling-off right has
      // to be explicitly waived at checkout, not assumed.
      consent_collection: {
        terms_of_service: "required",
      },
      custom_text: {
        terms_of_service_acceptance: {
          message:
            "I want to keep this programme starting today, and I understand I am waiving my right to a 14 day cooling off period under the Consumer Contracts Regulations 2013.",
        },
      },
      success_url: `${programmeUrl}?purchase=success`,
      cancel_url: `${programmeUrl}?purchase=cancelled`,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a Checkout URL.");
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("buy-outright checkout session create failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
