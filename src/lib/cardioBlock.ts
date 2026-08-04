// "any" is a genuine, storable choice -- a reusable template deliberately
// left modality-agnostic (e.g. "Easy Recovery" works as a jog, a spin, or a
// row) until a clinician picks a real one for a specific patient's drop,
// via the per-workout-item override -- not merely an absence of a value.
export type CardioModality = "running" | "cycling" | "ski_erg" | "row_erg" | "cross_trainer" | "any" | "other";

export const CARDIO_MODALITIES: { value: CardioModality; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "running", label: "Running" },
  { value: "cycling", label: "Cycling" },
  { value: "ski_erg", label: "Ski erg" },
  { value: "row_erg", label: "Row erg" },
  { value: "cross_trainer", label: "Cross trainer" },
  { value: "other", label: "Other" },
];

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
// patient alongside the block itself).
export type CardioCategory = "general" | "return_to_run";

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
  };
}

// The picker/library "tell apart at a glance" label -- Return to Run is its
// own group regardless of structure (it happens to be interval-shaped, but
// it's a distinct clinical category, not just another interval block).
export function cardioGroupLabel(d: { structure: CardioStructure; category: CardioCategory }): string {
  if (d.category === "return_to_run") return "Return to Run";
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

