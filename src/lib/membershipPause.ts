import "server-only";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getPatientMembership } from "@/lib/membership";

// Manual only -- something David does after a conversation with the
// patient, never a self-service button. Pausing stops billing without
// cancelling anything: tier, the patient_memberships row's tier, and every
// programme it gates all stay exactly as they are. Only Stripe collection
// (for a recurring membership) and this row's own status/paused_at change.
//
// For a recurring membership, pause_collection with behavior "void" is
// Stripe's own mechanism for this -- no invoices are generated while
// paused, so nothing accumulates to charge later; clearing it (resume)
// just lets normal billing continue from the next cycle. A prepay
// membership has no ongoing Stripe billing to pause at all, so this is
// purely a status flag for those -- expires_at is untouched either way,
// deliberately: extending a prepay term to account for a pause is a
// separate business decision, not assumed here.
export async function pauseMembership(patientId: string): Promise<void> {
  const membership = await getPatientMembership(patientId);
  if (membership.tier === "none") {
    throw new Error("This patient has no membership to pause.");
  }

  if (membership.billingType === "recurring" && membership.stripeSubscriptionId) {
    await getStripe().subscriptions.update(membership.stripeSubscriptionId, {
      pause_collection: { behavior: "void" },
    });
  }

  const { error } = await supabaseAdmin
    .from("patient_memberships")
    .update({ status: "paused", paused_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("patient_id", patientId);
  if (error) throw new Error(error.message);
}

export async function resumeMembership(patientId: string): Promise<void> {
  const membership = await getPatientMembership(patientId);
  if (membership.tier === "none") {
    throw new Error("This patient has no membership to resume.");
  }

  if (membership.billingType === "recurring" && membership.stripeSubscriptionId) {
    await getStripe().subscriptions.update(membership.stripeSubscriptionId, {
      pause_collection: null,
    });
  }

  const { error } = await supabaseAdmin
    .from("patient_memberships")
    .update({ status: "active", paused_at: null, updated_at: new Date().toISOString() })
    .eq("patient_id", patientId);
  if (error) throw new Error(error.message);
}
