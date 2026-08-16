import type { SlotType } from "@/lib/slotTypes";

export type BlockCategory = SlotType | "cardio";

export type CategoryMeta = {
  label: string;
  accent: string;
  accentSoft: string;
};

// One place every part of the app that shows a category (the nav's dots,
// library cards, workout builder slot cards, the patient's session view)
// reads its colour from -- see the four accent tokens in globals.css.
// Only the four categories David named get a colour; warm-up and cool-down
// stay neutral (--graphite on --frost) rather than inventing colours he
// didn't ask for.
export const CATEGORY_META: Record<BlockCategory, CategoryMeta> = {
  warm_up: { label: "Warm-up", accent: "var(--graphite)", accentSoft: "var(--frost)" },
  activation: { label: "Activation", accent: "var(--accent-activation)", accentSoft: "var(--accent-activation-soft)" },
  main_body: { label: "Main body", accent: "var(--accent-main-body)", accentSoft: "var(--accent-main-body-soft)" },
  injury_prevention: {
    label: "Injury Prevention",
    accent: "var(--accent-injury-prevention)",
    accentSoft: "var(--accent-injury-prevention-soft)",
  },
  cool_down: { label: "Cool-down", accent: "var(--graphite)", accentSoft: "var(--frost)" },
  cardio: { label: "Cardio", accent: "var(--accent-cardio)", accentSoft: "var(--accent-cardio-soft)" },
};

export function categoryMeta(category: BlockCategory | null | undefined): CategoryMeta | null {
  if (!category) return null;
  return CATEGORY_META[category] ?? null;
}
