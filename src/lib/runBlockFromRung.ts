// Turns one running_rungs row into the run_* fields a workout_items row
// needs (see 0084_run_blocks.sql) -- shared by the Running Builder's own
// first build (src/app/api/clinic/running-builder/route.ts) and by
// progression later moving a client onto a new rung
// (src/lib/runningProgression.ts), so a rung reads identically to the
// client either way.

export type LadderRungRow = {
  rung_number: number;
  repeats: number | null;
  run_portion: string | null;
  recovery: string | null;
  target_pace: string | null;
  effort_cue: string | null;
  total_running_minutes: string | null;
};

// "1.5 min run" -> {value:1.5, unit:"min"}; "Continuous outdoor 5K" -> no match.
// The Run block's own portion field is structured value+unit, but a ladder
// rung's is free text -- this is a best-effort bridge, not a guarantee
// every rung parses cleanly.
export function parseRunPortion(text: string | null): { value: number | null; unit: "min" | "km" | "m" | null } {
  if (!text) return { value: null, unit: null };
  const match = text.match(/^(\d+(?:\.\d+)?)\s*(min|km|m)\b/i);
  if (!match) return { value: null, unit: null };
  return { value: Number(match[1]), unit: match[2].toLowerCase() as "min" | "km" | "m" };
}

// "3 min walk" -> {duration:"3 min", type:"walk"}.
export function parseRecovery(text: string | null): { duration: string | null; type: "walk" | "jog" | "standing" } {
  if (!text) return { duration: null, type: "walk" };
  const match = text.match(/^(.*?)\b(walk|jog|standing)\b/i);
  if (!match) return { duration: text, type: "walk" };
  return { duration: match[1].trim() || null, type: match[2].toLowerCase() as "walk" | "jog" | "standing" };
}

export type RunItemFields = {
  is_run_block: true;
  run_title: string;
  run_repeats: number | null;
  run_portion_value: number | null;
  run_portion_unit: "min" | "km" | "m" | null;
  run_recovery_duration: string | null;
  run_recovery_type: "walk" | "jog" | "standing";
  run_target_pace: string | null;
  run_effort_cue: string | null;
  run_surface: string | null;
};

export function runItemFieldsFromRung(
  rung: LadderRungRow,
  opts: { easierEffort: boolean; treadmill: boolean }
): RunItemFields {
  const portion = parseRunPortion(rung.run_portion);
  const recovery = parseRecovery(rung.recovery);
  let effortCue = rung.effort_cue;
  if (opts.easierEffort) effortCue = effortCue ? `${effortCue}. Easier effort today.` : "Easier effort today.";
  if (!portion.value && rung.run_portion) {
    effortCue = effortCue ? `${effortCue} (${rung.run_portion})` : rung.run_portion;
  }
  return {
    is_run_block: true,
    run_title: `Rung ${rung.rung_number}`,
    run_repeats: rung.repeats,
    run_portion_value: portion.value,
    run_portion_unit: portion.unit,
    run_recovery_duration: recovery.duration,
    run_recovery_type: recovery.type,
    run_target_pace: rung.target_pace,
    run_effort_cue: effortCue,
    run_surface: opts.treadmill ? "Treadmill" : null,
  };
}
