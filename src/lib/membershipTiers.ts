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
  // This tier's own colour, forming a light-to-dark ramp from entry to
  // premium. accentDark is the darker end of the tonal-fade gradient used
  // on its Subscribe button and (on its own detail page) as the button's
  // border; the page background there is the flat accent colour itself.
  accent: string;
  accentDark: string;
  // Whichever of charcoal or white reads clearly against accent.
  onAccent: string;
};

export const MEMBERSHIP_TIERS: MembershipTierConfig[] = [
  {
    id: "member",
    name: "Athena Member",
    monthlyPriceGBP: 5.99,
    upfrontOptions: [],
    accent: "#EDC9CC",
    accentDark: "#B29799",
    onAccent: "#1C1C1C",
  },
  {
    id: "progress",
    name: "Athena Progress",
    monthlyPriceGBP: 24.99,
    upfrontOptions: [],
    accent: "#C97A80",
    accentDark: "#975C60",
    onAccent: "#1C1C1C",
  },
  {
    id: "performance",
    name: "Athena Performance",
    monthlyPriceGBP: 49.99,
    upfrontOptions: [
      { key: "6mo", label: "6 months, paid upfront", months: 6, priceGBP: 270 },
      { key: "12mo", label: "12 months, paid upfront", months: 12, priceGBP: 500 },
    ],
    accent: "#9B1C1C",
    accentDark: "#741515",
    onAccent: "#FFFFFF",
  },
  {
    id: "athlete",
    name: "Athena Athlete",
    monthlyPriceGBP: 149,
    upfrontOptions: [{ key: "12mo", label: "12 months, paid upfront", months: 12, priceGBP: 1500 }],
    accent: "#6B1111",
    accentDark: "#500D0D",
    onAccent: "#FFFFFF",
  },
];

export function getMembershipTier(id: string): MembershipTierConfig | undefined {
  return MEMBERSHIP_TIERS.find((t) => t.id === id);
}
