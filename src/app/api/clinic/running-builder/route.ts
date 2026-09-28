import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseRunningFramework, type RunningBuilderStrengthExercise } from "@/lib/runningBuilder";
import { runItemFieldsFromRung, type LadderRungRow } from "@/lib/runBlockFromRung";

// Reading and structuring a full running framework note, against the whole
// exercise library and every active ladder, is a heavier reasoning task
// than a scaffold pick -- same reasoning this app already gives the Block
// draft / scaffold generation calls, just for a larger note.
export const maxDuration = 90;

type RungRow = LadderRungRow;

async function createBlockFromExercises(
  name: string,
  type: string,
  weeks: number,
  exercises: { exercise_id: string | null; name: string; sets: number | null; reps: number | null; load?: string | null }[]
): Promise<string | null> {
  const matched = exercises.filter((e): e is typeof e & { exercise_id: string } => Boolean(e.exercise_id));
  if (matched.length === 0) return null;

  const blockId = crypto.randomUUID();
  const { error: blockError } = await supabaseAdmin
    .from("blocks")
    .insert({ id: blockId, name, type, block_length_weeks: weeks });
  if (blockError) throw new Error(blockError.message);

  for (let i = 0; i < matched.length; i++) {
    const ex = matched[i];
    const blockItemId = crypto.randomUUID();
    const { error: itemError } = await supabaseAdmin
      .from("block_items")
      .insert({ id: blockItemId, block_id: blockId, item_order: i + 1 });
    if (itemError) throw new Error(itemError.message);

    const weekRows = Array.from({ length: weeks }, (_, w) => ({
      block_item_id: blockItemId,
      week_number: w + 1,
      exercise_id: ex.exercise_id,
      sets: ex.sets,
      reps: ex.reps,
      rationale: ex.load ? `Load: ${ex.load}` : null,
    }));
    const { error: weeksError } = await supabaseAdmin.from("block_item_weeks").insert(weekRows);
    if (weeksError) throw new Error(weeksError.message);
  }

  return blockId;
}

async function createRunWorkout(
  name: string,
  prepBlockId: string | null,
  rung: RungRow | null,
  opts: { easierEffort: boolean; treadmill: boolean }
): Promise<string> {
  const workoutId = crypto.randomUUID();
  const { error: workoutError } = await supabaseAdmin.from("workouts").insert({ id: workoutId, name });
  if (workoutError) throw new Error(workoutError.message);

  let order = 1;
  const items: Record<string, unknown>[] = [];
  if (prepBlockId) {
    items.push({ workout_id: workoutId, item_order: order++, slot_type: "warm_up", block_id: prepBlockId, is_run_block: false });
  }
  if (rung) {
    items.push({
      workout_id: workoutId,
      item_order: order++,
      slot_type: "main_body",
      ...runItemFieldsFromRung(rung, opts),
    });
  }
  if (items.length > 0) {
    const { error: itemsError } = await supabaseAdmin.from("workout_items").insert(items);
    if (itemsError) throw new Error(itemsError.message);
  }
  return workoutId;
}

async function createCrossTrainingWorkout(
  name: string,
  options: { name: string; description: string | null }[]
): Promise<string | null> {
  if (options.length === 0) return null;
  const workoutId = crypto.randomUUID();
  const { error: workoutError } = await supabaseAdmin.from("workouts").insert({ id: workoutId, name });
  if (workoutError) throw new Error(workoutError.message);

  const items: Record<string, unknown>[] = [];
  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const cardioId = crypto.randomUUID();
    const modality = /bike|cycl/i.test(opt.name) ? "cycling" : "other";
    const { error: cardioError } = await supabaseAdmin.from("cardio_blocks").insert({
      id: cardioId,
      name: opt.name,
      modality,
      modality_other: modality === "other" ? opt.name : null,
      structure: "steady_state",
      rationale: opt.description,
    });
    if (cardioError) throw new Error(cardioError.message);
    items.push({ workout_id: workoutId, item_order: i + 1, slot_type: "main_body", cardio_block_id: cardioId, is_run_block: false });
  }
  const { error: itemsError } = await supabaseAdmin.from("workout_items").insert(items);
  if (itemsError) throw new Error(itemsError.message);
  return workoutId;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { patient_id, note, weeks } = body as { patient_id?: string; note?: string; weeks?: number };

  if (!patient_id) return NextResponse.json({ error: "Choose a client first." }, { status: 400 });
  if (!note?.trim()) return NextResponse.json({ error: "Paste the running framework first." }, { status: 400 });
  const programmeWeeks = Math.max(1, Math.min(12, Math.round(Number(weeks) || 4)));

  try {
    const [{ data: exercises, error: exercisesError }, { data: ladders, error: laddersError }] = await Promise.all([
      supabaseAdmin
        .from("exercises")
        .select("exercise_id, name_clinical, body_site, equipment")
        .eq("active", true)
        .order("exercise_id")
        .returns<{ exercise_id: string; name_clinical: string; body_site: string | null; equipment: string | null }[]>(),
      supabaseAdmin
        .from("running_ladders")
        .select("id, name, phase_label, running_rungs(rung_number, repeats, run_portion, recovery, target_pace, effort_cue, total_running_minutes)")
        .eq("active", true)
        .order("name")
        .returns<
          { id: string; name: string; phase_label: string | null; running_rungs: RungRow[] }[]
        >(),
    ]);
    if (exercisesError) throw new Error(exercisesError.message);
    if (laddersError) throw new Error(laddersError.message);

    const ladderCandidates = (ladders ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      phase_label: l.phase_label,
      rungs: [...l.running_rungs].sort((a, b) => a.rung_number - b.rung_number),
    }));

    const draft = await parseRunningFramework({
      note,
      exercises: (exercises ?? []).map((e) => ({
        exercise_id: e.exercise_id,
        name_clinical: e.name_clinical,
        body_site: e.body_site,
        equipment: e.equipment,
      })),
      ladders: ladderCandidates,
    });

    const matchedLadder = draft.ladder.ladder_id ? ladderCandidates.find((l) => l.id === draft.ladder.ladder_id) : undefined;
    const startRung =
      matchedLadder && draft.ladder.start_rung_number != null
        ? matchedLadder.rungs.find((r) => r.rung_number === draft.ladder.start_rung_number) ?? null
        : null;

    const prepBlockId = await createBlockFromExercises("Pre-run prep (Running Builder)", "warm_up", programmeWeeks, draft.pre_run_prep);
    const strengthBlockId = await createBlockFromExercises(
      "Running strength (Running Builder)",
      "main_body",
      programmeWeeks,
      draft.strength_session as RunningBuilderStrengthExercise[]
    );

    const qualityRunWorkoutId = await createRunWorkout("Quality run (Running Builder)", prepBlockId, startRung, {
      easierEffort: false,
      treadmill: false,
    });
    const easyRunWorkoutId = await createRunWorkout("Easy run (Running Builder)", prepBlockId, startRung, {
      easierEffort: true,
      treadmill: draft.weekly_structure.easy_run_treadmill,
    });

    let strengthWorkoutId: string | null = null;
    if (strengthBlockId) {
      strengthWorkoutId = crypto.randomUUID();
      const { error: workoutError } = await supabaseAdmin
        .from("workouts")
        .insert({ id: strengthWorkoutId, name: "Strength (Running Builder)" });
      if (workoutError) throw new Error(workoutError.message);
      const { error: itemError } = await supabaseAdmin
        .from("workout_items")
        .insert({ workout_id: strengthWorkoutId, item_order: 1, slot_type: "main_body", block_id: strengthBlockId });
      if (itemError) throw new Error(itemError.message);
    }

    const crossTrainingWorkoutId = await createCrossTrainingWorkout("Cross-training (Running Builder)", draft.cross_training);

    const { data: draftRow, error: draftError } = await supabaseAdmin
      .from("running_builder_drafts")
      .insert({
        patient_id,
        raw_note: note,
        ladder_id: draft.ladder.ladder_id,
        start_rung_number: draft.ladder.start_rung_number,
        header: draft.header,
        weekly_structure: draft.weekly_structure,
        cross_training: draft.cross_training,
        locked_blocks: draft.locked_blocks,
        rules: draft.rules,
        flags: draft.flags,
        weeks: programmeWeeks,
        quality_run_workout_id: qualityRunWorkoutId,
        easy_run_workout_id: easyRunWorkoutId,
        strength_workout_id: strengthWorkoutId,
        cross_training_workout_id: crossTrainingWorkoutId,
      })
      .select("id")
      .single<{ id: string }>();
    if (draftError) throw new Error(draftError.message);

    return NextResponse.json({ id: draftRow.id });
  } catch (err) {
    console.error("running builder generation failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't build a draft from that note: ${detail}` }, { status: 500 });
  }
}
