import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getShopProgramme } from "@/lib/shopProgrammes";
import { deepCopyAssignments, flattenAssignments } from "@/lib/copyProgrammeContent";
import { instantiateProgramme } from "@/lib/instantiateProgramme";
import { fulfilMembershipCheckout } from "@/lib/membershipFulfillment";
import type { MembershipTierId } from "@/lib/membershipTiers";
import { getMembershipTierIdForPriceId } from "@/lib/membershipStripePrices";
import { pauseSubscriptionGatedProgrammesForPatient } from "@/lib/programmeAccess";
import { sendProgrammeOwnedEmail } from "@/lib/email";
import { logCommunication } from "@/lib/communications";

type TemplateSource = {
  id: string;
  name: string;
  block_length_weeks: number;
  is_under_18: boolean;
  delivery_mode: "scheduled" | "open";
  programme_template_workouts: { workout_id: string; day_of_week: number | null }[];
};

type PatientRow = { first_name: string; email: string };

// Stripe calls this directly -- no patient cookie, no clinic password
// cookie, nothing this app's other auth checks would recognise. Trust comes
// entirely from the signature check below, not from where the request
// claims to come from, which is why this route deliberately sits outside
// the /api/shop/* and /api/clinic/* prefixes the rest of the app's auth
// model covers.
//
// This is also the only place a purchase or membership actually gets
// recorded. The Checkout Session that started the payment already proved
// the price; this event is what proves the money actually arrived -- a
// client returning to a success_url is not itself evidence of payment
// (that redirect can be skipped, replayed, or forged), so nothing is
// recorded until Stripe says so.
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("Missing stripe-signature header.");
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("stripe webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const checkoutType = session.metadata?.type;
    if (checkoutType === "membership") {
      await handleMembershipCheckoutCompleted(session, event.created);
    } else if (checkoutType === "buy_outright") {
      await handleBuyOutrightCheckoutCompleted(session);
    } else {
      await handleShopCheckoutCompleted(session, event.created);
    }
  } else if (event.type === "customer.subscription.updated") {
    await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
  } else if (event.type === "customer.subscription.deleted") {
    await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
  } else if (event.type === "invoice.payment_failed") {
    await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
  }

  return NextResponse.json({ received: true });
}

async function handleShopCheckoutCompleted(session: Stripe.Checkout.Session, eventCreated: number) {
  const patientId = session.metadata?.patient_id;
  const sectionSlug = session.metadata?.section_slug;
  const programmeSlug = session.metadata?.programme_slug;
  const programmeTitle = session.metadata?.programme_title;

  if (!patientId || !sectionSlug || !programmeSlug || !programmeTitle) {
    console.error("checkout.session.completed missing expected shop metadata", session.id);
    return;
  }

  // Stripe retries webhook deliveries. Checking for an existing purchase
  // row up front (rather than relying only on the insert's unique
  // constraint) means a retry can never re-run fulfilment and
  // double-create a programme -- it stops here before any of that work.
  const { data: existingPurchase, error: existingError } = await supabaseAdmin
    .from("purchases")
    .select("id")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();
  if (existingError) {
    console.error("purchase lookup failed", existingError.message);
    return;
  }
  if (existingPurchase) {
    return;
  }

  // The waiver checkbox is required at checkout (consent_collection in
  // /api/shop/checkout-session), so this should always be "accepted" --
  // logged loudly if it's ever not, but the purchase still gets recorded
  // either way. eventCreated is Stripe's own timestamp for when this
  // session completed, which is a more accurate consent timestamp than
  // whenever this handler happens to run.
  const coolingOffWaivedAt =
    session.consent?.terms_of_service === "accepted" ? new Date(eventCreated * 1000).toISOString() : null;
  if (!coolingOffWaivedAt) {
    console.error("checkout.session.completed without cooling-off waiver acceptance", session.id);
  }

  let programmeId: string | null = null;

  const shopProgramme = getShopProgramme(sectionSlug, programmeSlug);
  if (!shopProgramme?.templateId) {
    console.error("no programme template linked for shop listing, purchase recorded without a programme", {
      sectionSlug,
      programmeSlug,
    });
  } else {
    try {
      const { data: template, error: templateError } = await supabaseAdmin
        .from("programme_templates")
        .select(
          "id, name, block_length_weeks, is_under_18, delivery_mode, programme_template_workouts(workout_id, day_of_week)"
        )
        .eq("id", shopProgramme.templateId)
        .maybeSingle<TemplateSource>();
      if (templateError) throw new Error(templateError.message);

      if (!template) {
        console.error("linked programme template not found, purchase recorded without a programme", shopProgramme.templateId);
      } else if (template.is_under_18) {
        // The shop checkout collects no guardian/participant data, so an
        // under-18 template can't be safely auto-instantiated here --
        // same compliance rule the manual-attach route enforces.
        console.error("linked template is under-18, cannot auto-fulfil from shop checkout", template.id);
      } else {
        const { data: patient, error: patientError } = await supabaseAdmin
          .from("patients")
          .select("first_name, email")
          .eq("id", patientId)
          .maybeSingle<PatientRow>();
        if (patientError) throw new Error(patientError.message);
        if (!patient) throw new Error(`Patient ${patientId} not found.`);

        const copiedAssignments = await deepCopyAssignments(template.programme_template_workouts);
        const newProgrammeId = crypto.randomUUID();
        await instantiateProgramme({
          id: newProgrammeId,
          patientId,
          patientFirstName: patient.first_name,
          patientEmail: patient.email,
          title: template.name,
          blockLengthWeeks: template.block_length_weeks,
          deliveryMode: template.delivery_mode,
          assignments: flattenAssignments(copiedAssignments, template.delivery_mode),
          // A paid shop purchase -- "owned outright", never touched by a
          // membership lapsing.
          source: "owned",
          sourceTemplateId: template.id,
        });
        programmeId = newProgrammeId;
      }
    } catch (err) {
      console.error("programme fulfilment failed, purchase recorded without a programme", err);
    }
  }

  const { error } = await supabaseAdmin.from("purchases").insert({
    patient_id: patientId,
    section_slug: sectionSlug,
    programme_slug: programmeSlug,
    programme_title: programmeTitle,
    amount_gbp: session.amount_total != null ? Math.round(session.amount_total / 100) : 0,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id:
      typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null),
    programme_id: programmeId,
    cooling_off_waived_at: coolingOffWaivedAt,
  });
  // A duplicate delivery is already ruled out by the lookup above, so a
  // unique-constraint failure here would mean a genuine race -- still
  // logged rather than surfaced as a retry-worthy error, since the
  // programme (if any) has already been created and retrying would create
  // a second one.
  if (error) {
    console.error("purchase insert failed", error.message);
  }
}

async function handleBuyOutrightCheckoutCompleted(session: Stripe.Checkout.Session) {
  const patientId = session.metadata?.patient_id;
  const programmeId = session.metadata?.programme_id;
  const programmeTitle = session.metadata?.programme_title;

  if (!patientId || !programmeId || !programmeTitle) {
    console.error("checkout.session.completed missing expected buy-outright metadata", session.id);
    return;
  }

  // Same idempotency guard as the shop path -- the unique constraint on
  // stripe_checkout_session_id is what stops a Stripe retry from
  // re-sending the confirmation email a second time.
  const { data: existingPurchase, error: existingError } = await supabaseAdmin
    .from("purchases")
    .select("id")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();
  if (existingError) {
    console.error("buy-outright purchase lookup failed", existingError.message);
    return;
  }
  if (existingPurchase) {
    return;
  }

  const coolingOffWaivedAt = session.consent?.terms_of_service === "accepted" ? new Date().toISOString() : null;
  if (!coolingOffWaivedAt) {
    console.error("buy-outright checkout without cooling-off waiver acceptance", session.id);
  }

  // No new programme, no template, no copying -- this marks the patient's
  // own existing programme as owned outright. It keeps referencing the
  // same live blocks/workouts/exercises it always has; nothing about its
  // content changes, only its protection category. Deliberately doesn't
  // touch patient_memberships at all -- this purchase carries no tier and
  // grants none of the entitlements (like a messaging allowance) that
  // come with one.
  const { error: programmeError } = await supabaseAdmin
    .from("programmes")
    .update({ source: "owned" })
    .eq("id", programmeId);
  if (programmeError) {
    console.error("failed to mark programme owned outright, purchase still recorded", programmeError.message);
  }

  const { error: purchaseError } = await supabaseAdmin.from("purchases").insert({
    patient_id: patientId,
    purchase_type: "buy_outright",
    section_slug: null,
    programme_slug: null,
    programme_title: programmeTitle,
    programme_id: programmeId,
    amount_gbp: session.amount_total != null ? Math.round(session.amount_total / 100) : 0,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id:
      typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null),
    cooling_off_waived_at: coolingOffWaivedAt,
  });
  if (purchaseError) {
    console.error("buy-outright purchase insert failed", purchaseError.message);
  }

  const { data: patient, error: patientError } = await supabaseAdmin
    .from("patients")
    .select("first_name, email")
    .eq("id", patientId)
    .maybeSingle<PatientRow>();
  if (patientError || !patient) {
    console.error("buy-outright confirmation skipped, patient not found", patientId, patientError?.message);
    return;
  }

  const title = "Yours to keep";
  const body = `${programmeTitle} is yours now, for good. No expiry, no subscription attached to it.`;
  const { error: notificationError } = await supabaseAdmin.from("notifications").insert({
    patient_id: patientId,
    type: "programme_owned",
    title,
    body,
  });
  if (notificationError) {
    console.error("buy-outright notification insert failed", notificationError.message);
  }
  await logCommunication({ patientId, channel: "in_app", type: "programme_owned", title, body });

  try {
    await sendProgrammeOwnedEmail(patientId, patient.email, patient.first_name, programmeTitle);
  } catch (err) {
    console.error("buy-outright confirmation email failed", err);
  }
}

async function handleMembershipCheckoutCompleted(session: Stripe.Checkout.Session, _eventCreated: number) {
  const patientId = session.metadata?.patient_id;
  const tier = session.metadata?.tier as MembershipTierId | undefined;
  const billingType = session.metadata?.billing_type as "recurring" | "prepay" | undefined;
  const months = session.metadata?.months ? Number(session.metadata.months) : undefined;

  if (!patientId || !tier || !billingType) {
    console.error("checkout.session.completed missing expected membership metadata", session.id);
    return;
  }

  // Same idempotency reasoning as the shop path -- membership_events'
  // unique constraint on the session id is what stops a Stripe retry from
  // re-firing the "you're set up" email a second time.
  const { data: existingEvent, error: existingError } = await supabaseAdmin
    .from("membership_events")
    .select("id")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();
  if (existingError) {
    console.error("membership event lookup failed", existingError.message);
    return;
  }
  if (existingEvent) {
    return;
  }

  const { data: patient, error: patientError } = await supabaseAdmin
    .from("patients")
    .select("first_name, email")
    .eq("id", patientId)
    .maybeSingle<PatientRow>();
  if (patientError || !patient) {
    console.error("membership fulfilment failed, patient not found", patientId, patientError?.message);
    return;
  }

  const stripeSubscriptionId =
    typeof session.subscription === "string" ? session.subscription : (session.subscription?.id ?? null);

  try {
    await fulfilMembershipCheckout({
      patientId,
      patientFirstName: patient.first_name,
      patientEmail: patient.email,
      tierId: tier,
      billingType,
      months,
      stripeSubscriptionId,
    });
  } catch (err) {
    console.error("membership fulfilment failed", err);
    return;
  }

  const { error } = await supabaseAdmin.from("membership_events").insert({
    patient_id: patientId,
    tier,
    billing_type: billingType,
    amount_gbp: session.amount_total != null ? session.amount_total / 100 : 0,
    stripe_checkout_session_id: session.id,
    stripe_subscription_id: stripeSubscriptionId,
  });
  if (error) {
    console.error("membership event insert failed", error.message);
  }
}

// A subscription's ongoing lifecycle -- unlike checkout.session.completed,
// these three only ever touch an existing recurring membership, never
// create one, and they're plain status syncs rather than fulfilment: no
// email, no notification, just keeping patient_memberships honest. That
// also makes them safely idempotent without needing their own event-log
// guard -- applying the same update twice leaves the same end state.

type MembershipLookup = { patient_id: string };

async function findMembershipBySubscriptionId(subscriptionId: string): Promise<MembershipLookup | null> {
  const { data, error } = await supabaseAdmin
    .from("patient_memberships")
    .select("patient_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle<MembershipLookup>();
  if (error) {
    console.error("membership lookup by subscription id failed", subscriptionId, error.message);
    return null;
  }
  if (!data) {
    console.error("no membership found for subscription", subscriptionId);
    return null;
  }
  return data;
}

function isHealthySubscriptionStatus(status: Stripe.Subscription.Status): boolean {
  return status === "active" || status === "trialing";
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const membership = await findMembershipBySubscriptionId(subscription.id);
  if (!membership) return;

  // pause_collection (src/lib/membershipPause.ts) never changes Stripe's
  // own subscription.status -- it stays "active" throughout a manual
  // pause. Without this check, the webhook Stripe fires right after our
  // own pause_collection call would read status "active" and immediately
  // overwrite the "paused" status pauseMembership() just set, moments
  // earlier, in the same request. While pause_collection is set on the
  // subscription, this handler leaves patient_memberships alone entirely
  // -- membershipPause.ts is the sole writer of status while paused.
  if (subscription.pause_collection) {
    return;
  }

  // A plan change moves the subscription onto a different Price -- resolve
  // which tier that Price belongs to and update it alongside status, so a
  // tier change (not just a renewal) actually shows up here too. Keeps the
  // existing tier if the price can't be resolved, rather than guessing.
  const priceId = subscription.items.data[0]?.price?.id;
  const resolvedTier = priceId ? getMembershipTierIdForPriceId(priceId) : null;
  const status = isHealthySubscriptionStatus(subscription.status) ? "active" : "lapsed";

  const { error } = await supabaseAdmin
    .from("patient_memberships")
    .update({
      status,
      ...(resolvedTier ? { tier: resolvedTier } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("patient_id", membership.patient_id);
  if (error) {
    console.error("membership update from subscription.updated failed", error.message);
  }
  if (status === "lapsed") {
    await pauseProgrammesForLapsedMembership(membership.patient_id);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const membership = await findMembershipBySubscriptionId(subscription.id);
  if (!membership) return;

  const { error } = await supabaseAdmin
    .from("patient_memberships")
    .update({ status: "lapsed", updated_at: new Date().toISOString() })
    .eq("patient_id", membership.patient_id);
  if (error) {
    console.error("membership update from subscription.deleted failed", error.message);
  }
  await pauseProgrammesForLapsedMembership(membership.patient_id);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionRef = invoice.parent?.subscription_details?.subscription;
  const subscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : (subscriptionRef?.id ?? null);
  if (!subscriptionId) {
    // Not a subscription invoice -- nothing in this app generates those any
    // other way, but bail cleanly rather than assume.
    return;
  }

  const membership = await findMembershipBySubscriptionId(subscriptionId);
  if (!membership) return;

  const { error } = await supabaseAdmin
    .from("patient_memberships")
    .update({ status: "lapsed", updated_at: new Date().toISOString() })
    .eq("patient_id", membership.patient_id);
  if (error) {
    console.error("membership update from invoice.payment_failed failed", error.message);
  }
  await pauseProgrammesForLapsedMembership(membership.patient_id);
}

// The point where the subscription funnel actually bites -- membership
// going lapsed removes active access the same way a clinician manually
// unassigning a programme would (src/lib/programmeAccess.ts), without
// touching the programme row or its content.
async function pauseProgrammesForLapsedMembership(patientId: string) {
  try {
    await pauseSubscriptionGatedProgrammesForPatient(patientId);
  } catch (err) {
    console.error("failed to pause programme access for lapsed membership", patientId, err);
  }
}
