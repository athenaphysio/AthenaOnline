// A Run block's own fields -- one-off, filled in directly per placement
// rather than a shared library row (see 0084_run_blocks.sql's comment for
// why). Mirrors the workout_items run_* columns exactly, so a WorkoutItem
// can be passed straight in wherever these fields are needed.

export type RunPortionUnit = "min" | "km" | "m";
export type RunRecoveryType = "walk" | "jog" | "standing";

export type RunBlockFields = {
  run_title: string | null;
  run_warmup_walk: string | null;
  run_repeats: number | null;
  run_portion_value: number | null;
  run_portion_unit: RunPortionUnit | null;
  run_recovery_duration: string | null;
  run_recovery_type: RunRecoveryType | null;
  run_target_pace: string | null;
  run_effort_cue: string | null;
  run_surface: string | null;
  run_cooldown: string | null;
};

// Every run_* field, all null -- what a block/exercise/cardio item carries
// for these columns, since they're irrelevant to anything but a Run block.
export const NULL_RUN_BLOCK_FIELDS: RunBlockFields = {
  run_title: null,
  run_warmup_walk: null,
  run_repeats: null,
  run_portion_value: null,
  run_portion_unit: null,
  run_recovery_duration: null,
  run_recovery_type: null,
  run_target_pace: null,
  run_effort_cue: null,
  run_surface: null,
  run_cooldown: null,
};

// A freshly created Run block's starting fields -- named rather than blank
// so it's identifiable in the preview list immediately, before David fills
// anything else in.
export const BLANK_RUN_BLOCK_FIELDS: RunBlockFields = {
  ...NULL_RUN_BLOCK_FIELDS,
  run_title: "Run",
};

export const RUN_PORTION_UNITS: { value: RunPortionUnit; label: string }[] = [
  { value: "min", label: "min" },
  { value: "km", label: "km" },
  { value: "m", label: "m" },
];

export const RUN_RECOVERY_TYPES: { value: RunRecoveryType; label: string }[] = [
  { value: "walk", label: "Walk" },
  { value: "jog", label: "Jog" },
  { value: "standing", label: "Standing" },
];

export function cleanRunPortionUnit(value: unknown): RunPortionUnit | null {
  return value === "min" || value === "km" || value === "m" ? value : null;
}

export function cleanRunRecoveryType(value: unknown): RunRecoveryType | null {
  return value === "walk" || value === "jog" || value === "standing" ? value : null;
}

function recoveryTypeLabel(type: RunRecoveryType | null): string {
  if (type === "jog") return "jog";
  if (type === "standing") return "standing rest";
  return "walk";
}

// Total running time, in minutes -- only calculable when the run portion is
// a time (minutes); a distance-based portion (e.g. 400 m) has no fixed
// duration to sum from repeats alone, so this returns null for those.
export function runTotalMinutes(f: RunBlockFields): number | null {
  if (!f.run_repeats || !f.run_portion_value) return null;
  const unit = f.run_portion_unit ?? "min";
  if (unit !== "min") return null;
  return f.run_repeats * f.run_portion_value;
}

export function formatRunMinutes(minutes: number): string {
  return Number.isInteger(minutes) ? `${minutes} min` : `${minutes.toFixed(1)} min`;
}

// The client-facing one-liner, e.g. "4 x 2 min run at 4:45 to 5:00 /km, 2
// min walk between. Total running: 8 min."
export function runPlainSummary(f: RunBlockFields): string {
  if (!f.run_repeats || !f.run_portion_value) return "Run details not set yet";

  const unit = f.run_portion_unit ?? "min";
  let line = `${f.run_repeats} x ${f.run_portion_value} ${unit} run`;
  if (f.run_target_pace) line += ` at ${f.run_target_pace}`;
  if (f.run_recovery_duration) {
    line += `, ${f.run_recovery_duration} ${recoveryTypeLabel(f.run_recovery_type)} between`;
  }
  const totalMinutes = runTotalMinutes(f);
  if (totalMinutes != null) line += `. Total running: ${formatRunMinutes(totalMinutes)}`;
  return line;
}
