import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getVimeoInfo, type VimeoInfo } from "@/lib/vimeo";
import type { SessionProgrammeItem } from "@/app/session/TodaySession";
import { isCyclingModality, isRunningModality, BRICK_TRANSITION_NOTE, type CardioBlockDetail } from "@/lib/cardioBlock";

const CARDIO_COLUMNS =
  "id, name, modality, modality_other, structure, rationale, category, entry_criteria, stop_rule, tier, coaching_note, " +
  "steady_duration_seconds, steady_distance_m, steady_intensity_percent, steady_hr_zone, steady_pace, " +
  "steady_power_watts, steady_cadence, steady_incline_resistance, " +
  "interval_reps, interval_work_seconds, interval_intensities_percent, interval_rest_mode, " +
  "interval_rest_seconds, interval_rest_percent_recovered, interval_rest_type, interval_rest_type_other";

type Exercise = {
  exercise_id: string;
  name_clinical: string;
  name_patient_facing: string | null;
  vimeo_url: string | null;
};

type WorkoutItemRow = {
  id: string;
  item_order: number;
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
  exercises: Exercise | null;
};

type BlockItemRow = {
  id: string;
  block_id: string;
  item_order: number;
  block_item_weeks: {
    week_number: number;
    rationale: string | null;
    sets: number | null;
    reps: number | null;
    hold_seconds: number | null;
    percent_max: number | null;
    frequency: string | null;
    exercises: Exercise;
  }[];
};

type ResolvedExercise = {
  kind: "exercise";
  id: string;
  rationale: string | null;
  exercises: Exercise;
  sets: number | null;
  reps: number | null;
  hold_seconds: number | null;
  percent_max: number | null;
  frequency: string | null;
};

type ResolvedCardio = {
  kind: "cardio";
  id: string;
  rationale: string | null;
  cardio: CardioBlockDetail;
};

type Resolved = ResolvedExercise | ResolvedCardio;

// Resolves one Workout's items for one week -- shared by the Scheduled
// programme's "today" workout (week = whatever week it's on) and each Open
// programme's single workout (week is always 1, since Open blocks are
// always block_length_weeks 1 -- see 0019_delivery_mode.sql).
export async function resolveWorkoutItems(workoutId: string, week: number): Promise<Resolved[]> {
  const { data: workoutItems } = await supabaseAdmin
    .from("workout_items")
    .select(
      "id, item_order, block_id, exercise_id, cardio_block_id, cardio_modality_override, cardio_modality_other_override, sets, reps, hold_seconds, percent_max, frequency, rationale, exercises(exercise_id, name_clinical, name_patient_facing, vimeo_url)"
    )
    .eq("workout_id", workoutId)
    .order("item_order")
    .returns<WorkoutItemRow[]>();

  const items = workoutItems ?? [];
  const blockIds = Array.from(new Set(items.map((i) => i.block_id).filter((id): id is string => Boolean(id))));
  const cardioIds = Array.from(
    new Set(items.map((i) => i.cardio_block_id).filter((id): id is string => Boolean(id)))
  );

  const blockItemsByBlock = new Map<string, BlockItemRow[]>();
  if (blockIds.length > 0) {
    const { data: blockItems } = await supabaseAdmin
      .from("block_items")
      .select(
        "id, block_id, item_order, block_item_weeks(week_number, rationale, sets, reps, hold_seconds, percent_max, frequency, exercises(exercise_id, name_clinical, name_patient_facing, vimeo_url))"
      )
      .in("block_id", blockIds)
      .order("item_order")
      .returns<BlockItemRow[]>();

    for (const bi of blockItems ?? []) {
      if (!blockItemsByBlock.has(bi.block_id)) blockItemsByBlock.set(bi.block_id, []);
      blockItemsByBlock.get(bi.block_id)!.push(bi);
    }
  }

  const cardioById = new Map<string, CardioBlockDetail>();
  if (cardioIds.length > 0) {
    const { data: cardioBlocks } = await supabaseAdmin
      .from("cardio_blocks")
      .select(CARDIO_COLUMNS)
      .in("id", cardioIds)
      .returns<CardioBlockDetail[]>();
    for (const cardio of cardioBlocks ?? []) {
      cardioById.set(cardio.id, cardio);
    }
  }

  const resolved: Resolved[] = [];
  for (const item of items) {
    if (item.exercise_id && item.exercises) {
      resolved.push({
        kind: "exercise",
        id: item.id,
        rationale: item.rationale,
        exercises: item.exercises,
        sets: item.sets,
        reps: item.reps,
        hold_seconds: item.hold_seconds,
        percent_max: item.percent_max,
        frequency: item.frequency,
      });
      continue;
    }
    if (item.cardio_block_id) {
      const cardio = cardioById.get(item.cardio_block_id);
      if (cardio) {
        // The per-drop override (if this clinician set one for this
        // specific workout item) wins over the template's own default --
        // never the other way round, and never written back to the shared
        // template row.
        const effective: CardioBlockDetail = item.cardio_modality_override
          ? {
              ...cardio,
              modality: item.cardio_modality_override as CardioBlockDetail["modality"],
              modality_other: item.cardio_modality_other_override,
            }
          : cardio;
        resolved.push({ kind: "cardio", id: item.id, rationale: item.rationale, cardio: effective });
      }
      continue;
    }
    if (item.block_id) {
      const blockItems = (blockItemsByBlock.get(item.block_id) ?? []).sort((a, b) => a.item_order - b.item_order);
      for (const bi of blockItems) {
        const thisWeek =
          bi.block_item_weeks.find((w) => w.week_number === week) ??
          bi.block_item_weeks[bi.block_item_weeks.length - 1] ??
          null;
        if (!thisWeek) continue;
        resolved.push({
          kind: "exercise",
          id: bi.id,
          rationale: thisWeek.rationale,
          exercises: thisWeek.exercises,
          sets: thisWeek.sets,
          reps: thisWeek.reps,
          hold_seconds: thisWeek.hold_seconds,
          percent_max: thisWeek.percent_max,
          frequency: thisWeek.frequency,
        });
      }
    }
  }
  return resolved;
}

export async function toSessionItems(resolved: Resolved[]): Promise<SessionProgrammeItem[]> {
  const videos: (VimeoInfo | null)[] = await Promise.all(
    resolved.map((r) => (r.kind === "exercise" ? getVimeoInfo(r.exercises.vimeo_url) : Promise.resolve(null)))
  );
  return resolved.map((r, i) => {
    if (r.kind === "cardio") {
      // A brick: this cardio item is a run directly following a cycling
      // cardio item, in that order -- no clinician-set flag involved, just
      // the ordering the workout was built with.
      const prev = resolved[i - 1];
      const isBrickTransition =
        prev != null &&
        prev.kind === "cardio" &&
        isCyclingModality(prev.cardio.modality) &&
        isRunningModality(r.cardio.modality);

      return {
        kind: "cardio" as const,
        id: r.id,
        item_order: i + 1,
        rationale: r.rationale,
        cardio: r.cardio,
        brickTransitionNote: isBrickTransition ? BRICK_TRANSITION_NOTE : null,
      };
    }
    return {
      kind: "exercise" as const,
      id: r.id,
      item_order: i + 1,
      rationale: r.rationale,
      exercises: {
        exercise_id: r.exercises.exercise_id,
        name_clinical: r.exercises.name_clinical,
        name_patient_facing: r.exercises.name_patient_facing,
      },
      video: videos[i],
      sets: r.sets,
      reps: r.reps,
      hold_seconds: r.hold_seconds,
      percent_max: r.percent_max,
      frequency: r.frequency,
    };
  });
}
