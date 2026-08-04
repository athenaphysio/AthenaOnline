import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type MembershipTier = "none" | "member" | "progress" | "performance" | "athlete";
export type MembershipBillingType = "recurring" | "prepay";
export type MembershipStatus = "active" | "lapsed" | "paused" | "cancelled";

export type PatientMembership = {
  tier: MembershipTier;
  billingType: MembershipBillingType | null;
  status: MembershipStatus | null;
  expiresAt: string | null;
  stripeSubscriptionId: string | null;
  pausedAt: string | null;
};

const NO_MEMBERSHIP: PatientMembership = {
  tier: "none",
  billingType: null,
  status: null,
  expiresAt: null,
  stripeSubscriptionId: null,
  pausedAt: null,
};

type MembershipRow = {
  tier: Exclude<MembershipTier, "none">;
  billing_type: MembershipBillingType;
  status: MembershipStatus;
  expires_at: string | null;
  stripe_subscription_id: string | null;
  paused_at: string | null;
};

// The single place every other feature asks "does this patient have a
// membership, and which tier" -- messaging limits, wearable defaults, and
// shop pricing should all call this rather than querying
// patient_memberships directly, so what counts as "active" is only ever
// defined once (isActiveMembership below). No row for this patient means
// they've never had a membership set, same as the table's own comment --
// returned here as the tier "none" rather than null, so callers never have
// to special-case a missing row.
export async function getPatientMembership(patientId: string): Promise<PatientMembership> {
  const { data, error } = await supabaseAdmin
    .from("patient_memberships")
    .select("tier, billing_type, status, expires_at, stripe_subscription_id, paused_at")
    .eq("patient_id", patientId)
    .maybeSingle<MembershipRow>();
  if (error) throw new Error(error.message);
  if (!data) return NO_MEMBERSHIP;
  return {
    tier: data.tier,
    billingType: data.billing_type,
    status: data.status,
    expiresAt: data.expires_at,
    stripeSubscriptionId: data.stripe_subscription_id,
    pausedAt: data.paused_at,
  };
}

// A prepay's stored status can go stale -- nobody has to remember to come
// back and flip it to "lapsed" the day it expires. This treats a prepay
// past its own expiry date as not currently active regardless of what
// status says, the same way src/lib/patientStatus.ts derives a patient's
// standing from dates rather than trusting a stored value to stay current.
export function isActiveMembership(membership: PatientMembership): boolean {
  if (membership.tier === "none" || membership.status !== "active") return false;
  if (membership.billingType === "prepay" && membership.expiresAt) {
    return new Date(membership.expiresAt) >= new Date();
  }
  return true;
}
