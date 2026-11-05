// Shared, pure state-update helpers for editing a block's exercises and
// their week-by-week prescriptions. Used by BlockBuilder.tsx (the standalone
// Block Builder page) and BlockGroupEditor.tsx (a block expanded inline
// inside the Workout Builder) so both stay in lockstep instead of drifting.

import { PRESCRIPTION_DEFAULTS } from "@/lib/prescriptionDefaults";
import { cleanPrescriptionMode, type PrescriptionMode } from "@/lib/prescriptionMode";

export type EditorWeek = {
  week_number: number;
  exercise_id: string;
  name: string;
  rationale: string;
  sets: number | null;
  reps: number | null;
  hold_seconds: number | null;
  percent_max: number | null;
  frequency: string | null;
  prescription_mode: PrescriptionMode;
};

export type EditorItem = {
  key: string;
  weeks: EditorWeek[];
};

export type LibraryExerciseOption = {
  exercise_id: string;
  name_clinical: string;
  body_site: string | null;
  thumbnail_url: string | null;
  /** The exercise's Vimeo video, when it has one. */
  vimeo_url?: string | null;
  /** The start and finish picture, for an exercise without its own video. */
  illustration_url?: string | null;
  /** What this exercise starts in when newly added, so a drill David has
   * already marked isometric doesn't need re-toggling every time. Still
   * just a starting point -- overridable per instance, per week. */
  default_prescription_mode?: string | null;
};

let keyCounter = 0;
export function newItemKey(): string {
  keyCounter += 1;
  return `new-${Date.now()}-${keyCounter}`;
}

export function resizeWeeks(weeks: EditorWeek[], newLength: number): EditorWeek[] {
  if (newLength === weeks.length) return weeks;
  if (newLength < weeks.length) return weeks.slice(0, newLength);
  const last = weeks[weeks.length - 1];
  const extra: EditorWeek[] = [];
  for (let n = weeks.length + 1; n <= newLength; n++) {
    extra.push({ ...last, week_number: n });
  }
  return [...weeks, ...extra];
}

export function newEditorItem(exercise: LibraryExerciseOption, blockLengthWeeks: number): EditorItem {
  const prescriptionMode = cleanPrescriptionMode(exercise.default_prescription_mode);
  return {
    key: newItemKey(),
    weeks: Array.from({ length: blockLengthWeeks }, (_, i) => ({
      week_number: i + 1,
      exercise_id: exercise.exercise_id,
      name: exercise.name_clinical,
      rationale: "",
      ...PRESCRIPTION_DEFAULTS,
      prescription_mode: prescriptionMode,
    })),
  };
}

export function isExerciseAdded(items: EditorItem[], exercise: LibraryExerciseOption): boolean {
  return items.some((item) => item.weeks[0]?.exercise_id === exercise.exercise_id);
}

export function moveEditorItem(items: EditorItem[], index: number, direction: -1 | 1): EditorItem[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function removeEditorItem(items: EditorItem[], index: number): EditorItem[] {
  return items.filter((_, i) => i !== index);
}

export function updateWeekField(
  items: EditorItem[],
  itemKey: string,
  weekNumber: number,
  patch: Partial<EditorWeek>
): EditorItem[] {
  return items.map((item) =>
    item.key !== itemKey
      ? item
      : { ...item, weeks: item.weeks.map((w) => (w.week_number === weekNumber ? { ...w, ...patch } : w)) }
  );
}

export function changeWeekExercise(
  items: EditorItem[],
  itemKey: string,
  weekNumber: number,
  exerciseId: string,
  library: LibraryExerciseOption[]
): EditorItem[] {
  const opt = library.find((e) => e.exercise_id === exerciseId);
  if (!opt) return items;
  // Swapping to a different exercise mid-block also picks up that
  // exercise's own default mode -- the old exercise's Hold/% max values
  // wouldn't have meant anything for a reps drill anyway, or vice versa.
  return updateWeekField(items, itemKey, weekNumber, {
    exercise_id: exerciseId,
    name: opt.name_clinical,
    prescription_mode: cleanPrescriptionMode(opt.default_prescription_mode),
  });
}

export function updateNumericField(
  items: EditorItem[],
  itemKey: string,
  weekNumber: number,
  field: "sets" | "reps" | "hold_seconds" | "percent_max",
  value: string
): EditorItem[] {
  const num = value === "" ? null : Number(value);
  return updateWeekField(items, itemKey, weekNumber, { [field]: num === null || Number.isNaN(num) ? null : num });
}

/** A short, readable summary of one week's settings, such as "3 × 6" or
 * "2 × 30 s at 60%", used on collapsed exercise rows and in the
 * progression overview so the weeks can be compared without opening
 * every exercise one at a time. */
export function summariseWeek(w: EditorWeek | undefined): string {
  if (!w) return "";
  const sets = w.sets ?? null;
  if (w.prescription_mode === "time_under_load") {
    const hold = w.hold_seconds ? `${w.hold_seconds} s` : "";
    const pct = w.percent_max ? ` at ${w.percent_max}%` : "";
    if (sets && hold) return `${sets} × ${hold}${pct}`;
    if (hold) return `${hold}${pct}`;
    return sets ? `${sets} sets${pct}` : pct.trim();
  }
  if (sets && w.reps) return `${sets} × ${w.reps}`;
  if (sets) return `${sets} sets`;
  if (w.reps) return `${w.reps} reps`;
  return "";
}

/** True when a week differs from the one before it in anything the client
 * would notice: the exercise itself, the numbers, or how it is measured. */
export function weekChanged(prev: EditorWeek | undefined, cur: EditorWeek | undefined): boolean {
  if (!prev || !cur) return false;
  return (
    prev.exercise_id !== cur.exercise_id ||
    prev.prescription_mode !== cur.prescription_mode ||
    prev.sets !== cur.sets ||
    prev.reps !== cur.reps ||
    prev.hold_seconds !== cur.hold_seconds ||
    prev.percent_max !== cur.percent_max ||
    (prev.frequency ?? "") !== (cur.frequency ?? "")
  );
}

/** Copies one week's settings, for every exercise in the block, onto every
 * later week, so a progression can be set up by filling week 1 and then
 * nudging the numbers up week by week. Earlier weeks are left untouched. */
export function copyWeekForward(items: EditorItem[], fromWeek: number): EditorItem[] {
  return items.map((item) => {
    const source = item.weeks.find((w) => w.week_number === fromWeek);
    if (!source) return item;
    return {
      ...item,
      weeks: item.weeks.map((w) => (w.week_number > fromWeek ? { ...source, week_number: w.week_number } : w)),
    };
  });
}
