import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runItemFieldsFromRung, type LadderRungRow, type RunItemFields } from "@/lib/runBlockFromRung";

// Step 4 of the Running Builder brief: once a morning check-in comes in for
// a completed run, decide whether that run (combined with the one before
// it) is enough to move the client up a rung, drop them back one, or
// change nothing yet. Called from exactly one place --
// src/app/api/session/morning-checkin/route.ts, right after it records the
// answer -- and also read by the clinic's Approve/Hold screen
// (src/app/clinic/running-progression) for the actual rung-change logic.

type ProgrammeStateRow = {
  id: string;
  programme_id: string;
  patient_id: string;
  ladder_id: string;
  current_rung_number: number;
  quality_run_workout_id: string | null;
  easy_run_workout_id: string | null;
  consecutive_good_runs: number;
  consecutive_worse_mornings: number;
};

export type ProgressionOutcome =
  | { action: "none" }
  | { action: "at_top"; fromRung: number }
  | { action: "dropped_back"; fromRung: number; toRung: number }
  | { action: "progressed_automatic"; fromRung: number; toRung: number }
  | { action: "ready_to_progress"; fromRung: number; toRung: number };

async function fetchRung(ladderId: string, rungNumber: number): Promise<LadderRungRow | null> {
  const { data } = await supabaseAdmin
    .from("running_rungs")
    .select("rung_number, repeats, run_portion, recovery, target_pace, effort_cue, total_running_minutes")
    .eq("ladder_id", ladderId)
    .eq("rung_number", rungNumber)
    .maybeSingle<LadderRungRow>();
  return data ?? null;
}

async function isCurrentlyTreadmill(workoutId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("workout_items")
    .select("run_surface")
    .eq("workout_id", workoutId)
    .eq("is_run_block", true)
    .maybeSingle<{ run_surface: string | null }>();
  return data?.run_surface === "Treadmill";
}

async function writeRunItem(workoutId: string, fields: RunItemFields): Promise<void> {
  const { error } = await supabaseAdmin.from("workout_items").update(fields).eq("workout_id", workoutId).eq("is_run_block", true);
  if (error) throw new Error(error.message);
}

// Rewrites the Quality run and Easy run workouts' Run block content to a
// new rung, preserving each workout's own character (quality: full effort,
// no forced treadmill; easy: "Easier effort today," treadmill carried
// forward from whatever it's currently set to, since that was David's own
// one-time note-reading choice at build time, not something re-asked here).
export async function applyRungToProgramme(
  state: Pick<ProgrammeStateRow, "ladder_id" | "quality_run_workout_id" | "easy_run_workout_id">,
  newRungNumber: number
): Promise<void> {
  const rung = await fetchRung(state.ladder_id, newRungNumber);
  if (!rung) return;

  if (state.quality_run_workout_id) {
    await writeRunItem(state.quality_run_workout_id, runItemFieldsFromRung(rung, { easierEffort: false, treadmill: false }));
  }
  if (state.easy_run_workout_id) {
    const treadmill = await isCurrentlyTreadmill(state.easy_run_workout_id);
    await writeRunItem(state.easy_run_workout_id, runItemFieldsFromRung(rung, { easierEffort: true, treadmill }));
  }
}

// The brief's own rules, in order: two mornings of "worse" in a row always
// drops the client back one rung and always notifies David, regardless of
// their progression mode -- a safety signal, not a preference. Otherwise,
// two runs in a row that were finished as written, at or under the client's
// pain limit, and better/same the next morning either move them up
// straight away (automatic) or raise a pending event for David to approve
// or hold (ask_first, the default). Either counter resets to 0 the moment
// it either breaks or fires, so "two in a row" always means two *since the
// last change*, never a running total.
export async function evaluateRunProgression(sessionCompletionId: string): Promise<ProgressionOutcome> {
  const { data: completion } = await supabaseAdmin
    .from("session_completions")
    .select("id, patient_id, programme_id, run_completion_quality, run_pain_score, run_stable_id")
    .eq("id", sessionCompletionId)
    .maybeSingle<{
      id: string;
      patient_id: string;
      programme_id: string;
      run_completion_quality: "finished" | "partial" | "not_done" | null;
      run_pain_score: number | null;
      run_stable_id: string | null;
    }>();
  if (!completion || !completion.run_stable_id) return { action: "none" };

  const { data: checkin } = await supabaseAdmin
    .from("run_morning_checkins")
    .select("answer")
    .eq("session_completion_id", sessionCompletionId)
    .maybeSingle<{ answer: "better" | "same" | "worse" }>();
  if (!checkin) return { action: "none" };

  const { data: state } = await supabaseAdmin
    .from("running_programme_state")
    .select("id, programme_id, patient_id, ladder_id, current_rung_number, quality_run_workout_id, easy_run_workout_id, consecutive_good_runs, consecutive_worse_mornings")
    .eq("programme_id", completion.programme_id)
    .maybeSingle<ProgrammeStateRow>();
  if (!state) return { action: "none" };

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("running_pain_limit, running_progression_mode")
    .eq("id", completion.patient_id)
    .maybeSingle<{ running_pain_limit: number; running_progression_mode: "ask_first" | "automatic" }>();
  if (!patient) return { action: "none" };

  const runGood =
    completion.run_completion_quality === "finished" &&
    completion.run_pain_score != null &&
    completion.run_pain_score <= patient.running_pain_limit &&
    (checkin.answer === "better" || checkin.answer === "same");
  const runWorse = checkin.answer === "worse";

  const consecutiveGood = runGood ? state.consecutive_good_runs + 1 : 0;
  const consecutiveWorse = runWorse ? state.consecutive_worse_mornings + 1 : 0;

  if (consecutiveWorse >= 2) {
    const toRung = Math.max(1, state.current_rung_number - 1);
    if (toRung !== state.current_rung_number) {
      await applyRungToProgramme(state, toRung);
      const { error } = await supabaseAdmin.from("running_progression_events").insert({
        programme_state_id: state.id,
        patient_id: state.patient_id,
        kind: "dropped_back",
        status: "approved",
        from_rung_number: state.current_rung_number,
        to_rung_number: toRung,
        resolved_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    }
    await supabaseAdmin
      .from("running_programme_state")
      .update({ current_rung_number: toRung, consecutive_good_runs: 0, consecutive_worse_mornings: 0, updated_at: new Date().toISOString() })
      .eq("id", state.id);
    return { action: "dropped_back", fromRung: state.current_rung_number, toRung };
  }

  if (consecutiveGood >= 2) {
    const toRung = state.current_rung_number + 1;
    const nextRung = await fetchRung(state.ladder_id, toRung);
    if (!nextRung) {
      await supabaseAdmin
        .from("running_programme_state")
        .update({ consecutive_good_runs: 0, consecutive_worse_mornings: consecutiveWorse, updated_at: new Date().toISOString() })
        .eq("id", state.id);
      return { action: "at_top", fromRung: state.current_rung_number };
    }

    // Automatic rung moves are off -- progression decisions are now made
    // by David outside the app (the athena-plan-v1 direction). Every "two
    // good runs" moment raises a pending event for him to Approve or Hold,
    // regardless of what a patient's own running_progression_mode still
    // says from before this changed; that column is left in place (see
    // RunningProgrammeCard.tsx, whose Automatic option is now disabled)
    // rather than deleted, but nothing reads it here any more.
    const { error } = await supabaseAdmin.from("running_progression_events").insert({
      programme_state_id: state.id,
      patient_id: state.patient_id,
      kind: "ready_to_progress",
      status: "pending",
      from_rung_number: state.current_rung_number,
      to_rung_number: toRung,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("running_programme_state")
      .update({ consecutive_good_runs: 0, consecutive_worse_mornings: 0, updated_at: new Date().toISOString() })
      .eq("id", state.id);
    return { action: "ready_to_progress", fromRung: state.current_rung_number, toRung };
  }

  await supabaseAdmin
    .from("running_programme_state")
    .update({ consecutive_good_runs: consecutiveGood, consecutive_worse_mornings: consecutiveWorse, updated_at: new Date().toISOString() })
    .eq("id", state.id);
  return { action: "none" };
}
