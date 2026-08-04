import "server-only";
import { MEMBERSHIP_TIERS, type MembershipTierId } from "./membershipTiers";

// Maps a tier + option ("monthly", or an upfront option's key like "6mo")
// to its real Stripe Price id via env vars -- STRIPE_PRICE_MEMBER_MONTHLY,
// STRIPE_PRICE_PERFORMANCE_6MO, and so on. Price ids aren't secret, but
// they're mode-specific (a test-mode id used against a live-mode key fails
// outright), so they travel with STRIPE_SECRET_KEY in Vercel rather than
// living in a checked-in file -- switching test to live is swapping env
// vars, never a code change.
export function getMembershipPriceId(tierId: MembershipTierId, option: string): string {
  const envKey = `STRIPE_PRICE_${tierId.toUpperCase()}_${option.toUpperCase()}`;
  const value = process.env[envKey];
  if (!value) {
    throw new Error(`Missing Stripe price id env var ${envKey}. Add it in Vercel before this option can be bought.`);
  }
  return value;
}

// The reverse lookup -- given a Stripe Price id from a live subscription
// (subscription.items.data[0].price.id), which tier is that. Only checks
// monthly prices, since only a recurring membership has an ongoing Stripe
// Subscription object at all; an upfront prepay never generates
// subscription.* events. Used to detect a plan change on
// customer.subscription.updated. Returns null rather than throwing when
// nothing matches, since env vars may simply not be set up yet -- that's
// the caller's call on what to do (keep the membership's existing tier).
export function getMembershipTierIdForPriceId(priceId: string): MembershipTierId | null {
  for (const tier of MEMBERSHIP_TIERS) {
    if (process.env[`STRIPE_PRICE_${tier.id.toUpperCase()}_MONTHLY`] === priceId) {
      return tier.id;
    }
  }
  return null;
}
