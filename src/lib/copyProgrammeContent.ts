import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { CardioBlockDetail } from "@/lib/cardioBlock";

const CARDIO_COLUMNS =
  "id, name, modality, modality_other, structure, rationale, category, entry_criteria, stop_rule, tier, coaching_note, " +
  "steady_duration_seconds, steady_distance_m, steady_intensity_percent, steady_hr_zone, steady_pace, " +
  "steady_power_watts, steady_cadence, steady_incline_resistance, " +
  "interval_reps, interval_work_seconds, interval_intensities_percent, interval_rest_mode, " +
  "interval_rest_seconds, interval_rest_percent_recovered, interval_rest_type, interval_rest_type_other";

// Deep-copies workouts (and any blocks they reference) into brand-new rows,
// so a copy built from a template or a past client's programme can be
// edited without ever touching the source. Exercises themselves are never
// copied -- they're shared base library data, referenced by id everywhere
// else in the app, and stay that way here too.

export type CopiedAssignment = {
  key: string;
  workout_id: string;
  workout_name: string;
  high_load: boolean;
  // null means "not tied to a day" -- only ever appears for an Open
  // programme/template's single workout.
  days: (number | null)[];
};

type BlockItemWeekRow = {
  week_number: number;
  exercise_id: string;
  rationale: string | null;
  sets: number | null;
  reps: number | null;
  hold_seconds: number | null;
  percent_max: number | null;
  frequency: string | null;
};

type BlockItemRow = {
  id: string;
  item_order: number;
  block_item_weeks: BlockItemWeekRow[];
};

type BlockRow = {
  id: string;
  name: string;
  type: string;
  block_length_weeks: number;
  block_items: BlockItemRow[];
};

async function copyBlock(sourceBlockId: string): Promise<string> {
  const { data: block, error } = await supabaseAdmin
    .from("blocks")
    .select(
      "id, name, type, block_length_weeks, block_items(id, item_order, block_item_weeks(week_number, exercise_id, rationale, sets, reps, hold_seconds, percent_max, frequency))"
    )
    .eq("id", sourceBlockId)
    .maybeSingle<BlockRow>();
  if (error) throw new Error(error.message);
  if (!block) throw new Error(`Block ${sourceBlockId} not found.`);

  const newBlockId = crypto.randomUUID();
  const { error: blockError } = await supabaseAdmin.from("blocks").insert({
    id: newBlockId,
    name: block.name,
    type: block.type,
    block_length_weeks: block.block_length_weeks,
  });
  if (blockError) throw new Error(blockError.message);

  const sortedItems = [...block.block_items].sort((a, b) => a.item_order - b.item_order);
  for (let i = 0; i < sortedItems.length; i++) {
    const item = sortedItems[i];
    const { data: newItem, error: itemError } = await supabaseAdmin
      .from("block_items")
      .insert({ block_id: newBlockId, item_order: i + 1 })
      .select("id")
      .single();
    if (itemError) throw new Error(itemError.message);

    const weekRows = item.block_item_weeks.map((w) => ({
      block_item_id: newItem.id,
      week_number: w.week_number,
      exercise_id: w.exercise_id,
      rationale: w.rationale,
      sets: w.sets,
      reps: w.reps,
      hold_seconds: w.hold_seconds,
      percent_max: w.percent_max,
      frequency: w.frequency,
    }));
    if (weekRows.length > 0) {
      const { error: weeksError } = await supabaseAdmin.from("block_item_weeks").insert(weekRows);
      if (weeksError) throw new Error(weeksError.message);
    }
  }

  return newBlockId;
}

// Cardio blocks are a shared library row (same as a Block), so a copy
// gets its own clone too -- editing it afterwards from inside the copy
// must never reach back and mutate the source's cardio block.
async function copyCardioBlock(sourceCardioId: string): Promise<string> {
  const { data: cardio, error } = await supabaseAdmin
    .from("cardio_blocks")
    .select(CARDIO_COLUMNS)
    .eq("id", sourceCardioId)
    .maybeSingle<CardioBlockDetail>();
  if (error) throw new Error(error.message);
  if (!cardio) throw new Error(`Cardio block ${sourceCardioId} not found.`);

  const newCardioId = crypto.randomUUID();
  const { id: _sourceId, ...rest } = cardio;
  void _sourceId;
  const { error: cardioError } = await supabaseAdmin.from("cardio_blocks").insert({ id: newCardioId, ...rest });
  if (cardioError) throw new Error(cardioError.message);

  return newCardioId;
}

type WorkoutItemRow = {
  id: string;
  item_order: number;
  slot_type: string;
  block_id: string | null;
  exercise_id: string | null;
  cardio_block_id: string | null;
  cardio_modality_override: string | null;
  cardio_modality_other_override: string | null;
  sets: number | null;
  reps: number | null;
  hold_seconds: number | null;
  percent_max: number | null;
  frequency: string | null;
  rationale: string | null;
};

type WorkoutRow = {
  id: string;
  name: string;
  high_load: boolean;
  workout_items: WorkoutItemRow[];
};

async function copyWorkout(sourceWorkoutId: string): Promise<{ newWorkoutId: string; name: string; high_load: boolean }> {
  const { data: workout, error } = await supabaseAdmin
    .from("workouts")
    .select(
      "id, name, high_load, workout_items(id, item_order, slot_type, block_id, exercise_id, cardio_block_id, cardio_modality_override, cardio_modality_other_override, sets, reps, hold_seconds, percent_max, frequency, rationale)"
    )
    .eq("id", sourceWorkoutId)
    .maybeSingle<WorkoutRow>();
  if (error) throw new Error(error.message);
  if (!workout) throw new Error(`Workout ${sourceWorkoutId} not found.`);

  const newWorkoutId = crypto.randomUUID();
  const { error: workoutError } = await supabaseAdmin
    .from("workouts")
    .insert({ id: newWorkoutId, name: workout.name, high_load: workout.high_load });
  if (workoutError) throw new Error(workoutError.message);

  const sortedItems = [...workout.workout_items].sort((a, b) => a.item_order - b.item_order);

  // The same block (or cardio block) can appear more than once in one
  // workout (different slots) -- clone it once, reuse the clone for every
  // item that referenced it, same as the source did.
  const blockIdMap = new Map<string, string>();
  const cardioIdMap = new Map<string, string>();
  const rows: {
    workout_id: string;
    item_order: number;
    slot_type: string;
    block_id: string | null;
    exercise_id: string | null;
    cardio_block_id: string | null;
    cardio_modality_override: string | null;
    cardio_modality_other_override: string | null;
    sets: number | null;
    reps: number | null;
    hold_seconds: number | null;
    percent_max: number | null;
    frequency: string | null;
    rationale: string | null;
  }[] = [];

  for (let i = 0; i < sortedItems.length; i++) {
    const item = sortedItems[i];
    let newBlockId: string | null = null;
    if (item.block_id) {
      newBlockId = blockIdMap.get(item.block_id) ?? null;
      if (!newBlockId) {
        newBlockId = await copyBlock(item.block_id);
        blockIdMap.set(item.block_id, newBlockId);
      }
    }
    let newCardioId: string | null = null;
    if (item.cardio_block_id) {
      newCardioId = cardioIdMap.get(item.cardio_block_id) ?? null;
      if (!newCardioId) {
        newCardioId = await copyCardioBlock(item.cardio_block_id);
        cardioIdMap.set(item.cardio_block_id, newCardioId);
      }
    }
    rows.push({
      workout_id: newWorkoutId,
      item_order: i + 1,
      slot_type: item.slot_type,
      block_id: newBlockId,
      exercise_id: item.exercise_id,
      cardio_block_id: newCardioId,
      cardio_modality_override: item.cardio_modality_override,
      cardio_modality_other_override: item.cardio_modality_other_override,
      sets: item.sets,
      reps: item.reps,
      hold_seconds: item.hold_seconds,
      percent_max: item.percent_max,
      frequency: item.frequency,
      rationale: item.rationale,
    });
  }

  if (rows.length > 0) {
    const { error: itemsError } = await supabaseAdmin.from("workout_items").insert(rows);
    if (itemsError) throw new Error(itemsError.message);
  }

  return { newWorkoutId, name: workout.name, high_load: workout.high_load };
}

export async function deepCopyAssignments(
  sourceAssignments: { workout_id: string; day_of_week: number | null }[]
): Promise<CopiedAssignment[]> {
  const byWorkout = new Map<string, (number | null)[]>();
  for (const a of sourceAssignments) {
    const days = byWorkout.get(a.workout_id) ?? [];
    days.push(a.day_of_week);
    byWorkout.set(a.workout_id, days);
  }

  const result: CopiedAssignment[] = [];
  for (const [sourceWorkoutId, days] of byWorkout) {
    const { newWorkoutId, name, high_load } = await copyWorkout(sourceWorkoutId);
    result.push({ key: newWorkoutId, workout_id: newWorkoutId, workout_name: name, high_load, days });
  }
  return result;
}

// Mirrors the day-flattening ProgrammeBuilder.tsx does client-side before
// posting to /api/clinic/programmes -- deepCopyAssignments returns one row
// per copied workout with all its days attached, but instantiateProgramme
// (like the manual-attach route) wants one row per workout/day pair. Shared
// by every server-side path that copies a template into a real programme:
// the Stripe webhook and the free-template claim route.
export function flattenAssignments(
  assignments: CopiedAssignment[],
  deliveryMode: "scheduled" | "open"
): { workout_id: string; day_of_week: number | null }[] {
  if (deliveryMode === "open") {
    return assignments.slice(0, 1).map((row) => ({ workout_id: row.workout_id, day_of_week: null }));
  }
  return assignments.flatMap((row) =>
    row.days.filter((day): day is number => day != null).map((day) => ({ workout_id: row.workout_id, day_of_week: day }))
  );
}
