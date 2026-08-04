import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getStripe } from "@/lib/stripe";
import { getShopSection } from "@/lib/shopSections";
import { getShopProgramme } from "@/lib/shopProgrammes";

type PatientRow = { first_name: string; email: string };
type TemplateAccessRow = { access: "paid" | "free"; price_gbp: number | null };

// Creates a Stripe Checkout Session for one shop programme. The price never
// comes from the client -- section/programme slugs are resolved back to
// src/lib/shopProgrammes.ts (the same hand-kept config the sales page
// itself reads from) so what someone is charged always matches what's
// actually listed, not whatever a request happened to send.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { sectionSlug, programmeSlug } = body as { sectionSlug?: string; programmeSlug?: string };
  if (!sectionSlug || !programmeSlug) {
    return NextResponse.json({ error: "sectionSlug and programmeSlug are required." }, { status: 400 });
  }

  const section = getShopSection(sectionSlug);
  const programme = getShopProgramme(sectionSlug, programmeSlug);
  if (!section || !programme) {
    return NextResponse.json({ error: "Unknown programme." }, { status: 404 });
  }

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("first_name, email")
    .eq("id", user.id)
    .maybeSingle<PatientRow>();

  // Once a template's linked, its own price and access are authoritative --
  // never trust the marketing config alone, and never let a Free template
  // be bought through this route (ClaimButton is the only path for those;
  // this check is what stops that route being bypassed by calling this one
  // directly).
  let unitAmountGBP = programme.priceGBP;
  if (programme.templateId) {
    const { data: template } = await supabaseAdmin
      .from("programme_templates")
      .select("access, price_gbp")
      .eq("id", programme.templateId)
      .maybeSingle<TemplateAccessRow>();
    if (template) {
      if (template.access === "free") {
        return NextResponse.json({ error: "This programme is free, no payment needed." }, { status: 400 });
      }
      if (template.price_gbp != null) {
        unitAmountGBP = template.price_gbp;
      }
    }
  }

  // A comingSoon listing (or any programme with genuinely no price resolved
  // yet) has no BuyButton in the UI at all -- this is the server-side
  // backstop for that same rule, since a price can't be trusted to exist
  // just because a request hit this route.
  if (programme.comingSoon || unitAmountGBP == null) {
    return NextResponse.json({ error: "This programme isn't available for purchase yet." }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://athena-online-kappa.vercel.app";
  const programmeUrl = `${appUrl}/shop/${sectionSlug}/${programmeSlug}`;

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
            unit_amount: unitAmountGBP * 100,
            product_data: {
              name: programme.title,
              description: programme.summary,
            },
          },
        },
      ],
      metadata: {
        type: "shop_purchase",
        patient_id: user.id,
        section_slug: sectionSlug,
        programme_slug: programmeSlug,
        programme_title: programme.title,
      },
      // Stripe's Checkout custom_fields only support dropdown, numeric and
      // text, not an actual checkbox -- the terms-of-service consent
      // mechanism is the native way to put a required, custom-worded
      // tickbox in front of payment, and it is what records acceptance
      // (session.consent.terms_of_service) for the webhook to read back.
      // Needs a Terms of Service URL set in the Stripe Dashboard under
      // Settings > Public details, or Stripe will reject session creation.
      consent_collection: {
        terms_of_service: "required",
      },
      custom_text: {
        terms_of_service_acceptance: {
          message:
            "I want immediate access to this programme starting today, and I understand I am waiving my right to a 14 day cooling off period under the Consumer Contracts Regulations 2013.",
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
    console.error("stripe checkout session create failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
