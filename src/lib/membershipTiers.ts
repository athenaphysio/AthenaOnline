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
  // Explainer copy for this tier's own detail page (see athena_tier_
  // explainer_copy.docx) -- a short lead line plus what's included.
  oneLiner: string;
  features: string[];
  // Small scarcity badge, shown only on Athlete for now.
  label?: string;
  // Real photo for this tier's detail page -- a duotone colour grade
  // (dark accentDark shadows fading to a light accent-tinted highlight)
  // over David's own photo, so it reads as one colour family with the
  // page background rather than a clashing full-colour image.
  image: string;
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
    oneLiner: "Keep what we built.",
    features: ["Your programme stays live", "Message me when something flares"],
    image: "/membership/member.jpg",
  },
  {
    id: "progress",
    name: "Athena Progress",
    monthlyPriceGBP: 24.99,
    upfrontOptions: [],
    accent: "#C97A80",
    accentDark: "#975C60",
    onAccent: "#1C1C1C",
    oneLiner: "Keep getting stronger, in your own time.",
    features: [
      "Everything in Member",
      "Your programme moves on as you do, reviewed every quarter",
      "Message me whenever you need",
    ],
    image: "/membership/progress.jpg",
  },
  {
    id: "performance",
    name: "Athena Perform",
    monthlyPriceGBP: 49.99,
    upfrontOptions: [
      { key: "6mo", label: "6 months, paid upfront", months: 6, priceGBP: 270 },
      { key: "12mo", label: "12 months, paid upfront", months: 12, priceGBP: 500 },
    ],
    accent: "#9B1C1C",
    accentDark: "#741515",
    onAccent: "#FFFFFF",
    oneLiner:
      "For when your fitness and wellbeing really matter. Structured, reviewed, and moving toward your specific goals.",
    features: [
      "Everything in Progress",
      "Reprogrammed every six weeks, around how you're progressing",
      "A one-to-one with me at the start of every block",
      "Your training data reviewed each block, so we know the plan still fits",
    ],
    image: "/membership/performance.jpg",
  },
  {
    id: "athlete",
    name: "Athena Athlete",
    monthlyPriceGBP: 149,
    upfrontOptions: [{ key: "12mo", label: "12 months, paid upfront", months: 12, priceGBP: 1500 }],
    accent: "#6B1111",
    accentDark: "#500D0D",
    onAccent: "#FFFFFF",
    oneLiner: "Everything I've got, week in, week out.",
    features: [
      "Everything in Performance",
      "A one-to-one with me every week",
      "Reprogrammed continuously, not on a schedule",
      "A direct line to me whenever something comes up",
    ],
    label: "Five places only",
    image: "/membership/athlete.jpg",
  },
];

export function getMembershipTier(id: string): MembershipTierConfig | undefined {
  return MEMBERSHIP_TIERS.find((t) => t.id === id);
}
