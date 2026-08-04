// Display config for the four membership tiers -- names and prices as set
// up as real Products/Prices in Stripe. Safe to import into client
// components: no Stripe ids live here, just what the /membership page
// shows before someone taps a button. See membershipStripePrices.ts for
// where the actual Price ids come from.

export type MembershipTierId = "member" | "progress" | "performance" | "athlete";

export type MembershipUpfrontOption = {
  // Also the option key sent to /api/membership/checkout-session, and the
  // suffix membershipStripePrices.ts looks up the Stripe Price id with.
  key: string;
  label: string;
  months: number;
  priceGBP: number;
};

export type MembershipTierConfig = {
  id: MembershipTierId;
  name: string;
  monthlyPriceGBP: number;
  upfrontOptions: MembershipUpfrontOption[];
};

export const MEMBERSHIP_TIERS: MembershipTierConfig[] = [
  {
    id: "member",
    name: "Athena Member",
    monthlyPriceGBP: 5.99,
    upfrontOptions: [],
  },
  {
    id: "progress",
    name: "Athena Progress",
    monthlyPriceGBP: 24.99,
    upfrontOptions: [],
  },
  {
    id: "performance",
    name: "Athena Performance",
    monthlyPriceGBP: 49.99,
    upfrontOptions: [
      { key: "6mo", label: "6 months, paid upfront", months: 6, priceGBP: 270 },
      { key: "12mo", label: "12 months, paid upfront", months: 12, priceGBP: 500 },
    ],
  },
  {
    id: "athlete",
    name: "Athena Athlete",
    monthlyPriceGBP: 149,
    upfrontOptions: [{ key: "12mo", label: "12 months, paid upfront", months: 12, priceGBP: 1500 }],
  },
];

export function getMembershipTier(id: string): MembershipTierConfig | undefined {
  return MEMBERSHIP_TIERS.find((t) => t.id === id);
}
