import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { CardioBlockDetail } from "@/lib/cardioBlock";

const CARDIO_COLUMNS =
  "id, name, modality, modality_other, structure, rationale, category, entry_criteria, stop_rule, " +
  "steady_duration_seconds, steady_distance_m, steady_intensity_percent, steady_hr_zone, steady_pace, " +
  "steady_power_watts, steady_cadence, steady_incline_resistance, " +
  "interval_reps, interval_work_seconds, interval_intensities_percent, interval_rest_mode, " +
  "interval_rest_seconds, interval_rest_percent_recovered, interval_rest_type, interval_rest_type_other";

type IncomingItem = {
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
  blocks: { name: string } | null;
  exercises: { name_clinical: string } | null;
  cardio_blocks: { name: string } | null;
};

type WorkoutRow = {
  id: string;
  name: string;
  high_load: boolean;
  workout_items: WorkoutItemRow[];
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
  exercises: { name_clinical: string };
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

// Reused by both the standalone /clinic/workouts/[id] page and the inline
// editor mounted from the Programme Builder's calendar -- one round trip
// for a workout's items plus, for every item that references a block, that
// block's own exercises and per-week prescriptions.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [workoutRes, notesRes] = await Promise.all([
    supabaseAdmin
      .from("workouts")
      .select(
        "id, name, high_load, workout_items(id, item_order, slot_type, block_id, exercise_id, cardio_block_id, cardio_modality_override, cardio_modality_other_override, sets, reps, hold_seconds, percent_max, frequency, rationale, blocks(name), exercises(name_clinical), cardio_blocks(name))"
      )
      .eq("id", id)
      .maybeSingle<WorkoutRow>(),
    supabaseAdmin.from("workout_notes").select("notes").eq("workout_id", id).maybeSingle<{ notes: string | null }>(),
  ]);
  const { data: workout, error: workoutError } = workoutRes;

  if (workoutError) {
    return NextResponse.json({ error: workoutError.message }, { status: 500 });
  }
  if (!workout) {
    return NextResponse.json({ error: "Workout not found." }, { status: 404 });
  }

  const sortedItems = [...workout.workout_items].sort((a, b) => a.item_order - b.item_order);
  const items = sortedItems.map((item) => ({
    key: item.id,
    slot_type: item.slot_type,
    block_id: item.block_id,
    block_name: item.blocks?.name ?? null,
    exercise_id: item.exercise_id,
    exercise_name: item.exercises?.name_clinical ?? null,
    cardio_block_id: item.cardio_block_id,
    cardio_block_name: item.cardio_blocks?.name ?? null,
    cardio_modality_override: item.cardio_modality_override,
    cardio_modality_other_override: item.cardio_modality_other_override,
    sets: item.sets,
    reps: item.reps,
    hold_seconds: item.hold_seconds,
    percent_max: item.percent_max,
    frequency: item.frequency,
    rationale: item.rationale,
  }));

  const blockIds = Array.from(new Set(items.map((i) => i.block_id).filter((v): v is string => Boolean(v))));
  const cardioIds = Array.from(new Set(items.map((i) => i.cardio_block_id).filter((v): v is string => Boolean(v))));

  const blockDetails: Record<
    string,
    { id: string; name: string; type: string; block_length_weeks: number; items: unknown[] }
  > = {};

  if (blockIds.length > 0) {
    const { data: blocks, error: blocksError } = await supabaseAdmin
      .from("blocks")
      .select(
        "id, name, type, block_length_weeks, block_items(id, item_order, block_item_weeks(week_number, exercise_id, rationale, sets, reps, hold_seconds, percent_max, frequency, exercises(name_clinical)))"
      )
      .in("id", blockIds)
      .returns<BlockRow[]>();

    if (blocksError) {
      return NextResponse.json({ error: blocksError.message }, { status: 500 });
    }

    for (const block of blocks ?? []) {
      const sortedBlockItems = [...block.block_items].sort((a, b) => a.item_order - b.item_order);
      blockDetails[block.id] = {
        id: block.id,
        name: block.name,
        type: block.type,
        block_length_weeks: block.block_length_weeks,
        items: sortedBlockItems.map((bi) => ({
          key: bi.id,
          weeks: [...bi.block_item_weeks]
            .sort((a, b) => a.week_number - b.week_number)
            .map((w) => ({
              week_number: w.week_number,
              exercise_id: w.exercise_id,
              name: w.exercises.name_clinical,
              rationale: w.rationale ?? "",
              sets: w.sets,
              reps: w.reps,
              hold_seconds: w.hold_seconds,
              percent_max: w.percent_max,
              frequency: w.frequency,
            })),
        })),
      };
    }
  }

  const cardioBlockDetails: Record<string, CardioBlockDetail> = {};
  if (cardioIds.length > 0) {
    const { data: cardioBlocks, error: cardioError } = await supabaseAdmin
      .from("cardio_blocks")
      .select(CARDIO_COLUMNS)
      .in("id", cardioIds)
      .returns<CardioBlockDetail[]>();

    if (cardioError) {
      return NextResponse.json({ error: cardioError.message }, { status: 500 });
    }
    for (const cardio of cardioBlocks ?? []) {
      cardioBlockDetails[cardio.id] = cardio;
    }
  }

  return NextResponse.json({
    id: workout.id,
    name: workout.name,
    high_load: workout.high_load,
    notes: notesRes.data?.notes ?? null,
    items,
    blockDetails,
    cardioBlockDetails,
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { name, high_load, items, notes } = body as {
    name: string;
    high_load: boolean;
    items: IncomingItem[];
    notes?: string | null;
  };

  if (!name || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  try {
    const { error: workoutError } = await supabaseAdmin
      .from("workouts")
      .update({ name, high_load: high_load ?? false, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (workoutError) throw new Error(workoutError.message);

    const { error: deleteError } = await supabaseAdmin.from("workout_items").delete().eq("workout_id", id);
    if (deleteError) throw new Error(deleteError.message);

    const rows = items.map((item) => ({
      workout_id: id,
      item_order: item.item_order,
      slot_type: item.slot_type,
      block_id: item.block_id,
      exercise_id: item.exercise_id,
      cardio_block_id: item.cardio_block_id,
      cardio_modality_override: item.cardio_modality_override,
      cardio_modality_other_override: item.cardio_modality_other_override,
      sets: item.sets,
      reps: item.reps,
      hold_seconds: item.hold_seconds,
      percent_max: item.percent_max,
      frequency: item.frequency,
      rationale: item.rationale,
    }));
    const { error: itemsError } = await supabaseAdmin.from("workout_items").insert(rows);
    if (itemsError) throw new Error(itemsError.message);

    if (notes !== undefined) {
      const { error: notesError } = await supabaseAdmin.from("workout_notes").upsert({ workout_id: id, notes: notes || null });
      if (notesError) throw new Error(notesError.message);
    }

    return NextResponse.json({ id });
  } catch (err) {
    console.error("update workout failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Update failed: ${detail}` }, { status: 500 });
  }
}
