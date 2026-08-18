import { cleanPrescriptionMode, type PrescriptionMode } from "@/lib/prescriptionMode";

type Prescription = {
  sets: number | null;
  reps: number | null;
  hold_seconds: number | null;
  percent_max: number | null;
  frequency: string | null;
  prescription_mode?: PrescriptionMode | string | null;
};

// Gated on the mode, not on which fields happen to be null. Reps and hold
// seconds used to be told apart by "whichever one isn't blank," which broke
// as soon as anything backfilled reps on an isometric drill -- a genuinely
// held exercise showed "6 reps" instead of a hold duration. The mode is now
// the single source of truth for which of the two means anything here.
export function prescriptionChips(item: Prescription): string[] {
  const mode = cleanPrescriptionMode(item.prescription_mode);
  const chips: string[] = [];
  if (item.sets) chips.push(`${item.sets} sets`);
  if (mode === "time_under_load") {
    if (item.hold_seconds) chips.push(`${item.hold_seconds}s hold`);
    if (item.percent_max) chips.push(`${item.percent_max}% max`);
  } else if (item.reps) {
    chips.push(`${item.reps} reps`);
  }
  if (item.frequency) chips.push(item.frequency);
  return chips;
}

export function prescriptionSummary(item: Prescription): string {
  const mode = cleanPrescriptionMode(item.prescription_mode);
  if (mode === "time_under_load") {
    // "3 sets × 20s hold @ 75% max" -- % max hangs off the hold with "@ ",
    // not another "×", since it qualifies the hold rather than being a
    // third thing being done.
    const parts: string[] = [];
    if (item.sets) parts.push(`${item.sets} sets`);
    if (item.hold_seconds) parts.push(`${item.hold_seconds}s hold`);
    let summary = parts.join(" × ");
    if (item.percent_max) summary += ` @ ${item.percent_max}% max`;
    return summary;
  }
  const parts: string[] = [];
  if (item.sets) parts.push(`${item.sets} sets`);
  if (item.reps) parts.push(`${item.reps} reps`);
  return parts.join(" · ");
}
