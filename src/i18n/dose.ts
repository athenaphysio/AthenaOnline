import { cleanPrescriptionMode, type PrescriptionMode } from "@/lib/prescriptionMode";
import type { CardioBlockDetail } from "@/lib/cardioBlock";
import { BRICK_TRANSITION_NOTE } from "@/lib/cardioBlock";
import type { RunBlockFields, RunRecoveryType } from "@/lib/runBlock";
import { runTotalMinutes } from "@/lib/runBlock";
import type { SequenceType } from "@/lib/sequenceType";
import { modeOf, type CircuitExercise, type CircuitMode, type CircuitRun } from "@/lib/runCircuit";
import type { Translator } from "./translate";

// The client facing dose wording, in the client's own language. Each
// function follows the English original in src/lib exactly (same rules,
// same order), so the clinic keeps using the originals and the client sees
// the same sentence in their language. If a rule changes in one, change it
// in both.

type Prescription = {
  sets: number | null;
  reps: number | null;
  hold_seconds: number | null;
  percent_max: number | null;
  frequency: string | null;
  prescription_mode?: PrescriptionMode | string | null;
};

// Follows prescriptionChips in src/lib/prescription.ts.
export function prescriptionChipsT(item: Prescription, tr: Translator): string[] {
  const mode = cleanPrescriptionMode(item.prescription_mode);
  const chips: string[] = [];
  if (item.sets) chips.push(tr.tp("dose.sets", item.sets));
  if (mode === "time_under_load") {
    if (item.hold_seconds) chips.push(tr.t("dose.hold", { seconds: item.hold_seconds }));
    if (item.percent_max) chips.push(tr.t("dose.percentMax", { percent: item.percent_max }));
  } else if (item.reps) {
    chips.push(tr.tp("dose.reps", item.reps));
  }
  // Written by David for the client, so shown as written.
  if (item.frequency) chips.push(item.frequency);
  return chips;
}

// Follows prescriptionSummary in src/lib/prescription.ts.
export function prescriptionSummaryT(item: Prescription, tr: Translator): string {
  const mode = cleanPrescriptionMode(item.prescription_mode);
  const parts: string[] = [];
  if (item.sets) parts.push(tr.tp("dose.sets", item.sets));
  if (mode === "time_under_load") {
    if (item.hold_seconds) parts.push(tr.t("dose.hold", { seconds: item.hold_seconds }));
    let summary = parts.join(" × ");
    if (item.percent_max) summary += ` @ ${tr.t("dose.percentMax", { percent: item.percent_max })}`;
    return summary;
  }
  if (item.reps) parts.push(tr.tp("dose.reps", item.reps));
  return parts.join(" · ");
}

const MODALITY_KEYS = {
  any: "dose.modAny",
  running: "dose.modRunning",
  treadmill: "dose.modTreadmill",
  treadmill_walk: "dose.modTreadmillWalk",
  outdoor_run: "dose.modOutdoorRun",
  cycling: "dose.modCycling",
  ski_erg: "dose.modSkiErg",
  row_erg: "dose.modRowErg",
  cross_trainer: "dose.modCrossTrainer",
  other: "dose.modOther",
} as const;

// Follows cardioModalityLabel in src/lib/cardioBlock.ts.
export function cardioModalityLabelT(modality: string, other: string | null | undefined, tr: Translator): string {
  if (modality === "other") return (other && other.trim()) || tr.t("dose.modOther");
  const key = MODALITY_KEYS[modality as keyof typeof MODALITY_KEYS];
  return key ? tr.t(key) : modality;
}

function durationT(seconds: number | null | undefined, tr: Translator): string | null {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return tr.t("dose.durSec", { seconds: s });
  if (s === 0) return tr.t("dose.durMin", { minutes: m });
  return `${m}:${String(s).padStart(2, "0")}`;
}

function intensityBandT(percent: number, tr: Translator): string {
  if (percent < 65) return tr.t("dose.easy");
  if (percent < 85) return tr.t("dose.medium");
  return tr.t("dose.hard");
}

function restPhraseT(d: CardioBlockDetail, tr: Translator): string | null {
  const bits: string[] = [];
  if (d.interval_rest_mode === "percent_recovered") {
    bits.push(tr.t("dose.restUntilRecovered"));
  } else {
    const restDur = durationT(d.interval_rest_seconds, tr);
    if (restDur) bits.push(tr.t("dose.restFor", { time: restDur }));
  }
  if (d.interval_rest_type) {
    if (d.interval_rest_type === "other") bits.push(d.interval_rest_type_other || tr.t("dose.restOther"));
    else if (d.interval_rest_type === "walking") bits.push(tr.t("dose.restWalking"));
    else if (d.interval_rest_type === "stationary") bits.push(tr.t("dose.restStationary"));
    else bits.push(d.interval_rest_type);
  }
  return bits.length > 0 ? bits.join(", ") : null;
}

// Follows cardioPlainSummary in src/lib/cardioBlock.ts.
export function cardioPlainSummaryT(d: CardioBlockDetail, tr: Translator): string {
  if (d.structure === "steady_state") {
    const parts: string[] = [];
    parts.push(durationT(d.steady_duration_seconds, tr) ?? tr.t("dose.durationNotSet"));
    if (d.steady_intensity_percent != null) parts.push(intensityBandT(d.steady_intensity_percent, tr));
    return parts.join(", ");
  }
  const parts: string[] = [];
  if (d.interval_reps && d.interval_work_seconds) {
    parts.push(`${d.interval_reps} x ${durationT(d.interval_work_seconds, tr)}`);
  } else if (d.interval_reps) {
    parts.push(tr.tp("dose.reps", d.interval_reps));
  } else {
    parts.push(tr.t("dose.intervalsNotSet"));
  }
  const intensities = (d.interval_intensities_percent ?? []).filter((v): v is number => v != null);
  if (intensities.length > 0) parts.push(intensities.map((p) => intensityBandT(p, tr)).join(" → "));
  const rest = restPhraseT(d, tr);
  if (rest) parts.push(rest);
  return parts.join(", ");
}

// The app's own note for a run straight after a bike; anything else David
// wrote himself is shown as written.
export function brickNoteT(note: string, tr: Translator): string {
  return note === BRICK_TRANSITION_NOTE ? tr.t("practice.brickNote") : note;
}

function recoveryT(type: RunRecoveryType | null, tr: Translator): string {
  if (type === "jog") return tr.t("dose.recoveryJog");
  if (type === "standing") return tr.t("dose.recoveryStanding");
  return tr.t("dose.recoveryWalk");
}

// Follows runPlainSummary in src/lib/runBlock.ts.
export function runPlainSummaryT(f: RunBlockFields, tr: Translator): string {
  if (!f.run_repeats || !f.run_portion_value) return tr.t("dose.runNotSet");
  const unit = f.run_portion_unit ?? "min";
  const vars = { repeats: f.run_repeats, amount: f.run_portion_value, unit, pace: f.run_target_pace ?? "" };
  let line = f.run_target_pace ? tr.t("dose.runLineAtPace", vars) : tr.t("dose.runLine", vars);
  if (f.run_recovery_duration) {
    line += `, ${tr.t("dose.recoveryBetween", { duration: f.run_recovery_duration, type: recoveryT(f.run_recovery_type, tr) })}`;
  }
  const total = runTotalMinutes(f);
  if (total != null) {
    const time = tr.t("dose.durMin", { minutes: Number.isInteger(total) ? total : total.toFixed(1) });
    line += `. ${tr.t("dose.totalRunning", { time })}`;
  }
  return line;
}

const BADGE_KEYS = {
  superset: "dose.superset",
  circuit: "dose.circuit",
  unilateral: "dose.unilateral",
  alternating: "dose.alternating",
} as const;

// Follows badgeForSequenceType in src/lib/sequenceType.ts.
export function sequenceBadgeT(sequenceType: SequenceType, tr: Translator): string | null {
  if (sequenceType === "straight_sets") return null;
  return tr.t(BADGE_KEYS[sequenceType]);
}

// Run Circuits, following src/lib/runCircuit.ts.

const MODE_KEYS: Record<CircuitMode, "circuit.modeRun" | "circuit.modeWalk" | "circuit.modeBike" | "circuit.modeCrossTrainer" | "circuit.modeRow"> = {
  run: "circuit.modeRun",
  walk: "circuit.modeWalk",
  bike: "circuit.modeBike",
  cross_trainer: "circuit.modeCrossTrainer",
  row: "circuit.modeRow",
};

export function modeLabelT(run: Pick<CircuitRun, "mode">, tr: Translator): string {
  return tr.t(MODE_KEYS[modeOf(run)]);
}

export function formatSecondsT(total: number, tr: Translator): string {
  const s = Math.max(0, Math.round(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return tr.t("circuit.timeSec", { seconds: r });
  if (r === 0) return tr.t("circuit.timeMin", { minutes: m });
  return tr.t("circuit.timeMinSec", { minutes: m, seconds: r });
}

// How hard or fast, for example "9 km/h, 1% incline, effort 5 out of 10".
export function runHowT(run: CircuitRun, tr: Translator): string {
  const parts: string[] = [];
  const mode = modeOf(run);
  if (run.speed_kmh != null && (mode === "run" || mode === "walk")) parts.push(tr.t("circuit.speed", { speed: run.speed_kmh }));
  if (run.incline_pct != null && run.incline_pct > 0) parts.push(tr.t("circuit.incline", { incline: run.incline_pct }));
  if (run.effort != null) parts.push(tr.t("circuit.effort", { effort: run.effort }));
  return parts.join(", ");
}

// Follows runText: "Run 3 min at effort 5 out of 10".
export function runTextT(run: CircuitRun, tr: Translator): string {
  const how = runHowT(run, tr);
  const vars = { mode: modeLabelT(run, tr), time: formatSecondsT(run.run_seconds, tr), how };
  return how ? tr.t("circuit.runLineAt", vars) : tr.t("circuit.runLine", vars);
}

// Follows doseText: "8 reps each side".
export function doseTextT(ex: Pick<CircuitExercise, "dose_type" | "amount" | "per_side">, tr: Translator): string {
  if (!ex.amount) return tr.t("circuit.doseTbc");
  const dose =
    ex.dose_type === "time"
      ? tr.tp("circuit.seconds", ex.amount)
      : ex.dose_type === "contacts"
        ? tr.tp("circuit.contacts", ex.amount)
        : tr.tp("circuit.reps", ex.amount);
  return ex.per_side ? tr.t("circuit.eachSide", { dose }) : dose;
}
