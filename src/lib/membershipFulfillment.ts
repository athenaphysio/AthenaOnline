import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logCommunication } from "@/lib/communications";
import { sendMembershipReadyEmail } from "@/lib/email";
import { getMembershipTier, type MembershipTierId } from "@/lib/membershipTiers";

export type FulfilMembershipInput = {
  patientId: string;
  patientFirstName: string;
  patientEmail: string;
  tierId: MembershipTierId;
  billingType: "recurring" | "prepay";
  // Only meaningful for prepay -- how long the access window is.
  months?: number;
  // Only meaningful for recurring.
  stripeSubscriptionId?: string | null;
};

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

// Called once, by the Stripe webhook, after a membership checkout (monthly
// subscription or upfront prepay) actually succeeds. Sets
// patient_memberships to the single source of truth other features read,
// then fires the same notification + communications-log + email pattern
// instantiateProgramme.ts already established for "your programme's
// ready", just for a membership instead of a programme.
export async function fulfilMembershipCheckout(input: FulfilMembershipInput): Promise<void> {
  const tier = getMembershipTier(input.tierId);
  if (!tier) throw new Error(`Unknown membership tier ${input.tierId}`);

  const expiresAt =
    input.billingType === "prepay" && input.months
      ? addMonths(new Date(), input.months).toISOString().slice(0, 10)
      : null;

  const { error: upsertError } = await supabaseAdmin.from("patient_memberships").upsert(
    {
      patient_id: input.patientId,
      tier: input.tierId,
      billing_type: input.billingType,
      status: "active",
      expires_at: expiresAt,
      stripe_subscription_id: input.stripeSubscriptionId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "patient_id" }
  );
  if (upsertError) throw new Error(upsertError.message);

  // Athena Athlete already promises full performance data analysis, so
  // wearable tracking defaults on the moment someone signs up for it --
  // this fires exactly once, since a Checkout Session (unlike a renewal)
  // only ever completes once per subscription. It's still just a default:
  // David can switch it off, and it's never re-applied automatically after
  // this, so his own later choice on the patient record always wins.
  if (input.tierId === "athlete") {
    const { error: wearableError } = await supabaseAdmin
      .from("patients")
      .update({ wearable_tracking_enabled: true })
      .eq("id", input.patientId);
    if (wearableError) {
      console.error("failed to default wearable tracking on for athlete signup", wearableError.message);
    }
  }

  const title = "You're set up";
  const body = `Your ${tier.name} membership is active. Open the app to see what's included.`;

  const { error: notificationError } = await supabaseAdmin.from("notifications").insert({
    patient_id: input.patientId,
    type: "membership_ready",
    title,
    body,
  });
  if (notificationError) throw new Error(notificationError.message);
  await logCommunication({
    patientId: input.patientId,
    channel: "in_app",
    type: "membership_ready",
    title,
    body,
  });

  try {
    await sendMembershipReadyEmail(input.patientId, input.patientEmail, input.patientFirstName, tier.name);
  } catch (err) {
    console.error("membership ready email failed", err);
  }
}
