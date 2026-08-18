// Whether a drill is prescribed by reps, or by time under load at a
// percentage of force. Reps-and-sets is the default and covers ordinary
// strength work; time-under-load is for isometric holds, where a rep count
// is meaningless -- David prescribes those by hold duration and % max
// instead. This is a mode, not a separate content type: any non-cardio
// exercise can carry either.
export type PrescriptionMode = "reps_and_sets" | "time_under_load";

export const PRESCRIPTION_MODES: { value: PrescriptionMode; label: string }[] = [
  { value: "reps_and_sets", label: "Reps & Sets" },
  { value: "time_under_load", label: "Time under load" },
];

export function cleanPrescriptionMode(value: unknown): PrescriptionMode {
  return value === "time_under_load" ? "time_under_load" : "reps_and_sets";
}

// A time-under-load week still allows the reps field's data to survive a
// mode switch (nothing is deleted, only hidden), but reps is never read
// for display or shown in the editor while this mode is active.
export function fieldsForMode(mode: PrescriptionMode): {
  showReps: boolean;
  showHoldAndMax: boolean;
} {
  return mode === "time_under_load"
    ? { showReps: false, showHoldAndMax: true }
    : { showReps: true, showHoldAndMax: false };
}
