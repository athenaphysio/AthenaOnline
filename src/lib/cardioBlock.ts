// "any" is a genuine, storable choice -- a reusable template deliberately
// left modality-agnostic (e.g. "Easy Recovery" works as a jog, a spin, or a
// row) until a clinician picks a real one for a specific patient's drop,
// via the per-workout-item override -- not merely an absence of a value.
// "treadmill" and "outdoor_run" are the two running-specific modalities used
// by the Running Progression category -- treadmill gives pace control and
// is the safer starting point, outdoor uses perceived effort once someone's
// progressed. Kept distinct from the generic "running" value used elsewhere
// (e.g. Return to Run), which doesn't carry that surface distinction.
export type CardioModality =
  | "running"
  | "treadmill"
  | "outdoor_run"
  | "cycling"
  | "ski_erg"
  | "row_erg"
  | "cross_trainer"
  | "any"
  | "other";

export const CARDIO_MODALITIES: { value: CardioModality; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "running", label: "Running" },
  { value: "treadmill", label: "Treadmill" },
  { value: "outdoor_run", label: "Outdoor run" },
  { value: "cycling", label: "Cycling" },
  { value: "ski_erg", label: "Ski erg" },
  { value: "row_erg", label: "Row erg" },
  { value: "cross_trainer", label: "Cross trainer" },
  { value: "other", label: "Other" },
];

const RUNNING_FAMILY_MODALITIES: CardioModality[] = ["running", "treadmill", "outdoor_run"];

export function isRunningModality(modality: string): boolean {
  return RUNNING_FAMILY_MODALITIES.includes(modality as CardioModality);
}

export function isCyclingModality(modality: string): boolean {
  return modality === "cycling";
}

// A "brick" is a session chaining two disciplines back to back, most
// commonly bike straight into run -- no new data structure, just a cycling
// cardio block immediately followed by a running one within the same
// workout (see workoutResolution.ts's toSessionItems, which detects this
// ordering and attaches this note to the run item). The leg-feel shift from
// cycling to running is a real, trainable thing worth flagging, not a sign
// something's wrong.
export const BRICK_TRANSITION_NOTE =
  "The first few minutes of the run will feel harder than the pace suggests; that's normal, not a sign of overreaching.";

export function cardioModalityLabel(modality: string, other?: string | null): string {
  if (modality === "other") return (other && other.trim()) || "Other";
  return CARDIO_MODALITIES.find((m) => m.value === modality)?.label ?? modality;
}

export type CardioStructure = "steady_state" | "intervals";
export const CARDIO_STRUCTURES: { value: CardioStructure; label: string }[] = [
  { value: "steady_state", label: "Steady-state" },
  { value: "intervals", label: "Intervals" },
];

export type CardioRestType = "walking" | "stationary" | "other";
export const CARDIO_REST_TYPES: { value: CardioRestType; label: string }[] = [
  { value: "walking", label: "Walking" },
  { value: "stationary", label: "Stationary" },
  { value: "other", label: "Other" },
];

export type CardioRestMode = "fixed_time" | "percent_recovered";

// "general" is any reusable cardio block; "return_to_run" is a genuine
// rehab series (not generic S&C) that carries entry_criteria (a clinician
// reminder shown before adding one to a patient's programme -- a prompt to
// confirm, never a hard gate the app enforces) and stop_rule (shown to the
// patient alongside the block itself). "running_progression" and
// "cycling_progression" are general capacity-building for people who can
// already do some amount of the activity -- distinct from Return to Run,
// which is post-injury rehab -- organised by starting capacity via the
// tier field below, and carry coaching_note rather than entry_criteria/
// stop_rule. Cycling is non-weight-bearing, so its volume can generally
// progress a little more liberally than running's, but the same principle
// applies to both: hold a stage for several sessions before advancing, and
// cap a single session's jump rather than use a fixed formula, since
// there's no clinical-evidence base to draw a firm number from for either.
export type CardioCategory = "general" | "return_to_run" | "running_progression" | "cycling_progression";
export const CARDIO_CATEGORIES: { value: CardioCategory; label: string }[] = [
  { value: "general", label: "General" },
  { value: "return_to_run", label: "Return to Run" },
  { value: "running_progression", label: "Running Progression" },
  { value: "cycling_progression", label: "Cycling Progression" },
];

// Only meaningful when category is "running_progression" or
// "cycling_progression" -- which of the three starting-capacity tiers a
// block belongs to.
export type CardioTier = "base_building" | "recreational" | "trained";
export const CARDIO_TIERS: { value: CardioTier; label: string }[] = [
  { value: "base_building", label: "Base Building" },
  { value: "recreational", label: "Recreational" },
  { value: "trained", label: "Trained" },
];

export function cardioTierLabel(tier: string | null | undefined): string | null {
  if (!tier) return null;
  return CARDIO_TIERS.find((t) => t.value === tier)?.label ?? tier;
}

// Full shape of one cardio_blocks row -- a shared library entity, same as a
// Block, referenced by id from many workout_items rows. No per-week
// progression (unlike a Block): one fixed prescription per row.
export type CardioBlockDetail = {
  id: string;
  name: string;
  modality: CardioModality;
  modality_other: string | null;
  structure: CardioStructure;
  rationale: string | null;
  category: CardioCategory;
  entry_criteria: string | null;
  stop_rule: string | null;
  tier: CardioTier | null;
  coaching_note: string | null;

  steady_duration_seconds: number | null;
  steady_distance_m: number | null;
  steady_intensity_percent: number | null;
  steady_hr_zone: string | null;
  steady_pace: string | null;
  steady_power_watts: number | null;
  steady_cadence: number | null;
  steady_incline_resistance: string | null;

  interval_reps: number | null;
  interval_work_seconds: number | null;
  interval_intensities_percent: (number | null)[] | null;
  interval_rest_mode: CardioRestMode | null;
  interval_rest_seconds: number | null;
  interval_rest_percent_recovered: number | null;
  interval_rest_type: CardioRestType | null;
  interval_rest_type_other: string | null;

  // A monitor-driven preset (e.g. Concept2) that a client works through by
  // pressing buttons in order, rather than something the app derives from
  // the fields above. PM5 and PM3/PM4 are stored separately since the two
  // generations don't always share the same sequence for the same workout.
  // Null on every cardio block that isn't a monitor preset.
  button_sequence_pm5: string | null;
  button_sequence_pm3_4: string | null;
};

export function newCardioBlockDetail(
  id: string,
  name: string,
  modality: CardioModality,
  structure: CardioStructure,
  category: CardioCategory = "general"
): CardioBlockDetail {
  return {
    id,
    name,
    modality,
    modality_other: null,
    structure,
    rationale: null,
    category,
    entry_criteria: null,
    stop_rule: null,
    tier: null,
    coaching_note: null,
    steady_duration_seconds: null,
    steady_distance_m: null,
    steady_intensity_percent: null,
    steady_hr_zone: null,
    steady_pace: null,
    steady_power_watts: null,
    steady_cadence: null,
    steady_incline_resistance: null,
    interval_reps: null,
    interval_work_seconds: null,
    interval_intensities_percent: null,
    interval_rest_mode: null,
    interval_rest_seconds: null,
    interval_rest_percent_recovered: null,
    interval_rest_type: null,
    interval_rest_type_other: null,
    button_sequence_pm5: null,
    button_sequence_pm3_4: null,
  };
}

// The picker/library "tell apart at a glance" label -- Return to Run,
// Running Progression, and Cycling Progression are their own groups
// regardless of structure (all three happen to be interval-shaped, but
// they're distinct clinical categories, not just another interval block).
// A progression category's tier is folded in here too, since the three
// tiers read as genuinely separate groups once populated.
export function cardioGroupLabel(d: { structure: CardioStructure; category: CardioCategory; tier?: CardioTier | null }): string {
  if (d.category === "return_to_run") return "Return to Run";
  if (d.category === "running_progression" || d.category === "cycling_progression") {
    const categoryLabel = d.category === "running_progression" ? "Running Progression" : "Cycling Progression";
    const tierLabel = cardioTierLabel(d.tier);
    return tierLabel ? `${categoryLabel}: ${tierLabel}` : categoryLabel;
  }
  return d.structure === "steady_state" ? "Steady-state" : "Intervals";
}

// Grows or shrinks the per-rep intensity array to match a new rep count,
// keeping whatever values already exist rather than resetting them --
// dropping from 5 reps to 3 and back to 5 should still remember the first
// three.
export function resizeIntensities(current: (number | null)[] | null, reps: number): (number | null)[] {
  const arr = current ? [...current] : [];
  while (arr.length < reps) arr.push(null);
  arr.length = Math.max(0, reps);
  return arr;
}

function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m} min`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Converts a raw intensity percentage into a plain word a client reads
// instantly, rather than a number they'd have to interpret themselves.
// Thresholds are a display simplification, not a clinical claim -- easy to
// recalibrate here in one place if David wants different cut points.
function intensityBand(percent: number): string {
  if (percent < 65) return "easy";
  if (percent < 85) return "medium";
  return "hard";
}

function restPhrase(d: CardioBlockDetail): string | null {
  const bits: string[] = [];
  if (d.interval_rest_mode === "percent_recovered") {
    bits.push("rest until recovered");
  } else {
    const restDur = formatDuration(d.interval_rest_seconds);
    if (restDur) bits.push(`rest ${restDur}`);
  }
  if (d.interval_rest_type) {
    bits.push(d.interval_rest_type === "other" ? d.interval_rest_type_other || "other rest" : d.interval_rest_type);
  }
  return bits.length > 0 ? bits.join(", ") : null;
}

// The client-facing "structure and target metrics in plain terms" line,
// deliberately excluding modality (shown separately, alongside this) --
// e.g. "5 x 1 min, easy -> medium -> hard -> medium -> easy, rest until
// recovered" for intervals, or "20 min, medium" for steady-state.
export function cardioPlainSummary(d: CardioBlockDetail): string {
  if (d.structure === "steady_state") {
    const parts: string[] = [];
    const dur = formatDuration(d.steady_duration_seconds);
    parts.push(dur ?? "duration not set yet");
    if (d.steady_intensity_percent != null) parts.push(intensityBand(d.steady_intensity_percent));
    return parts.join(", ");
  }

  const parts: string[] = [];
  if (d.interval_reps && d.interval_work_seconds) {
    parts.push(`${d.interval_reps} x ${formatDuration(d.interval_work_seconds)}`);
  } else if (d.interval_reps) {
    parts.push(`${d.interval_reps} reps`);
  } else {
    parts.push("intervals not set yet");
  }

  const intensities = (d.interval_intensities_percent ?? []).filter((v): v is number => v != null);
  if (intensities.length > 0) {
    parts.push(intensities.map(intensityBand).join(" → "));
  }

  const rest = restPhrase(d);
  if (rest) parts.push(rest);

  return parts.join(", ");
}

