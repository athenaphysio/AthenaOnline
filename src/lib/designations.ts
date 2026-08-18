import type { CardioBlockDetail } from "@/lib/cardioBlock";

// A format designation is a searchable label on a block or a workout, not a
// content type of its own. David's requirement: "as long as I can search
// and see all the blocks and workouts that are HIIT format, all good." So
// HIIT is a way of marking things that already exist rather than a separate
// table, a separate builder, or a fourth thing to keep in sync.
//
// Multi-valued on purpose: a 30 seconds on, 30 seconds off bike block is
// genuinely both HIIT and Cardio, and a single-value field would force a
// choice that loses information.
export type Designation = "hiit" | "cardio" | "mobility";

export const DESIGNATIONS: { value: Designation; label: string; hint: string }[] = [
  { value: "hiit", label: "HIIT", hint: "Work and rest intervals at high effort." },
  { value: "cardio", label: "Cardio", hint: "Aerobic work, whatever the modality." },
  { value: "mobility", label: "Mobility", hint: "Range of movement and control." },
];

export function designationLabel(value: string): string {
  return DESIGNATIONS.find((d) => d.value === value)?.label ?? value;
}

// Only values in the list above are stored, so a stray designation from an
// older build or a hand-edited row can't leak into the UI as a bare slug.
export function cleanDesignations(values: unknown): Designation[] {
  if (!Array.isArray(values)) return [];
  const allowed = new Set(DESIGNATIONS.map((d) => d.value));
  return values.filter((v): v is Designation => typeof v === "string" && allowed.has(v as Designation));
}

// Cardio blocks are not given their own designations column. Everything a
// designation would say about one is already in its own fields, so it is
// derived instead -- one fact in one place, and no risk of a cardio block
// being tagged "Cardio: no". Interval and pyramid formats are exactly what
// HIIT means for a machine-based piece.
export function designationsForCardioBlock(
  block: Pick<CardioBlockDetail, "structure" | "format">
): Designation[] {
  const out: Designation[] = ["cardio"];
  if (block.structure === "intervals" || block.format === "intervals" || block.format === "pyramid") {
    out.push("hiit");
  }
  return out;
}
