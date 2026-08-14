import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type CardioGoalCategory = "ongoing" | "event";
export type CardioBaselineDiscipline = "running" | "cycling";
export type CardioBaselineUnit = "minutes" | "km" | "miles";
export type CardioBaselineSource = "prefilled" | "clinician_entered";

export type GoalTarget = { id: string; name: string; category: CardioGoalCategory };

export type CardioBaseline = {
  discipline: CardioBaselineDiscipline;
  value_number: number;
  value_unit: CardioBaselineUnit;
  source: CardioBaselineSource;
};

// Ironman 70.3/full need an independent baseline for both disciplines;
// every other event or ongoing goal only ever needs running. Matched by
// name rather than a stored flag, since goal_targets is a small, hand-kept
// list -- see 0064_goal_based_cardio_setup.sql.
export function disciplinesFor(goalTargetName: string | null): CardioBaselineDiscipline[] {
  if (goalTargetName === "Ironman 70.3" || goalTargetName === "Full Ironman") {
    return ["running", "cycling"];
  }
  return ["running"];
}

// Whole weeks between the programme's own start date and the target event
// date -- computed on read, never stored, so it can't go stale if either
// date changes. Null until both exist.
export function weeksUntilEvent(startDate: string | null, targetEventDate: string | null): number | null {
  if (!startDate || !targetEventDate) return null;
  const start = new Date(startDate);
  const target = new Date(targetEventDate);
  const days = Math.round((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.floor(days / 7);
}

const RUNNING_MODALITIES = ["running", "treadmill", "outdoor_run"];

// "The longest comfortable continuous effort right now" -- best-effort
// from what's actually recorded. session_completions only ever records
// that a cardio block was ticked off, never real logged duration/pace, so
// this reads the *prescribed* duration of the longest steady-state cardio
// block the patient has actually completed for that discipline, rather
// than a true performance log. Null (not a guess) if nothing matches --
// David enters it by hand in that case, same as the return-to-run
// protocol's own "find your baseline" step.
export async function prefillBaseline(
  patientId: string,
  discipline: CardioBaselineDiscipline
): Promise<{ value_number: number; value_unit: CardioBaselineUnit } | null> {
  const { data } = await supabaseAdmin
    .from("session_completions")
    .select("cardio_blocks(modality, structure, steady_duration_seconds)")
    .eq("patient_id", patientId)
    .eq("status", "completed")
    .not("cardio_block_id", "is", null)
    .returns<{ cardio_blocks: { modality: string; structure: string; steady_duration_seconds: number | null } | null }[]>();

  const modalities = discipline === "running" ? RUNNING_MODALITIES : ["cycling"];
  let longestSeconds: number | null = null;
  for (const row of data ?? []) {
    const c = row.cardio_blocks;
    if (!c || c.structure !== "steady_state" || !c.steady_duration_seconds) continue;
    if (!modalities.includes(c.modality)) continue;
    if (longestSeconds == null || c.steady_duration_seconds > longestSeconds) {
      longestSeconds = c.steady_duration_seconds;
    }
  }

  if (longestSeconds == null) return null;
  return { value_number: Math.round(longestSeconds / 60), value_unit: "minutes" };
}
