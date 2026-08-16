export type SequenceType = "straight_sets" | "superset" | "circuit" | "unilateral" | "alternating";

export const SEQUENCE_TYPES: { value: SequenceType; label: string }[] = [
  { value: "straight_sets", label: "Straight sets" },
  { value: "superset", label: "Superset" },
  { value: "circuit", label: "Circuit" },
  { value: "unilateral", label: "Unilateral, right then left" },
  { value: "alternating", label: "Alternating sides" },
];

// Shown to the patient as an unmissable badge at the top of the block --
// straight_sets is the default, ordinary case and gets no badge at all
// (see badgeForSequenceType below), so it isn't listed here.
export const SEQUENCE_BADGE_LABEL: Record<Exclude<SequenceType, "straight_sets">, string> = {
  superset: "Superset",
  circuit: "Circuit",
  unilateral: "Unilateral: right then left",
  alternating: "Alternating sides",
};

export function badgeForSequenceType(sequenceType: SequenceType): string | null {
  if (sequenceType === "straight_sets") return null;
  return SEQUENCE_BADGE_LABEL[sequenceType];
}

// Only these two need a live "which side now" indicator -- superset and
// circuit are about ordering/rest, not sidedness.
export function needsSideIndicator(sequenceType: SequenceType): boolean {
  return sequenceType === "unilateral" || sequenceType === "alternating";
}
