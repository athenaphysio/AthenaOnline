import Image from "next/image";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../../../clinic.module.css";
import WorkoutBuilder, { type ExerciseOption, type WorkoutItem } from "../../WorkoutBuilder";
import type { BlockDetail } from "../../../builder/BlockGroupEditor";
import type { SlotType } from "@/lib/slotTypes";
import type { CardioBlockDetail, CardioModality } from "@/lib/cardioBlock";
import { cleanWorkoutKind } from "@/lib/workoutKind";
import { cleanPrescriptionMode } from "@/lib/prescriptionMode";
import ClinicBrandbar from "../../../ClinicBrandbar";

const DEFAULT_NEW_BLOCK_LENGTH_WEEKS = 4;

type ItemRow = {
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
  prescription_mode: string | null;
  rationale: string | null;
  blocks: { name: string } | null;
  exercises: { name_clinical: string } | null;
  cardio_blocks: { name: string } | null;
};

type Workout = {
  id: string;
  name: string;
  high_load: boolean;
  designations: string[] | null;
  kind: string | null;
  workout_items: ItemRow[];
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
  prescription_mode: string | null;
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

export default async function DuplicateWorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [{ data: workout }, { data: library }] = await Promise.all([
    supabaseAdmin
      .from("workouts")
      .select(
        "id, name, high_load, designations, kind, workout_items(id, item_order, slot_type, block_id, exercise_id, cardio_block_id, cardio_modality_override, cardio_modality_other_override, sets, reps, hold_seconds, percent_max, frequency, prescription_mode, rationale, blocks(name), exercises(name_clinical), cardio_blocks(name))"
      )
      .eq("id", id)
      .maybeSingle<Workout>(),
    supabaseAdmin
      .from("exercises")
      .select("exercise_id, name_clinical, body_site, thumbnail_url, default_prescription_mode")
      .eq("active", true)
      .order("exercise_id"),
  ]);

  if (!workout) {
    notFound();
  }

  const sortedItems = [...workout.workout_items].sort((a, b) => a.item_order - b.item_order);

  const initialItems: WorkoutItem[] = sortedItems.map((item, i) => ({
    key: `item-${i}`,
    slot_type: item.slot_type as SlotType,
    block_id: item.block_id,
    block_name: item.blocks?.name ?? null,
    exercise_id: item.exercise_id,
    exercise_name: item.exercises?.name_clinical ?? null,
    cardio_block_id: item.cardio_block_id,
    cardio_block_name: item.cardio_blocks?.name ?? null,
    cardio_modality_override: item.cardio_modality_override as CardioModality | null,
    cardio_modality_other_override: item.cardio_modality_other_override,
    sets: item.sets,
    reps: item.reps,
    hold_seconds: item.hold_seconds,
    percent_max: item.percent_max,
    frequency: item.frequency,
    prescription_mode: cleanPrescriptionMode(item.prescription_mode),
    rationale: item.rationale,
  }));

  const newWorkoutId = crypto.randomUUID();

  // The duplicate keeps referencing the same shared blocks as the original
  // (a real, deliberate copy would need its own blocks -- not part of this
  // flow) -- so its block details are fetched the same way as the standalone
  // edit page.
  const blockIds = Array.from(new Set(initialItems.map((i) => i.block_id).filter((v): v is string => Boolean(v))));
  const initialBlockDetails: Record<string, BlockDetail> = {};

  if (blockIds.length > 0) {
    const { data: blocks } = await supabaseAdmin
      .from("blocks")
      .select(
        "id, name, type, block_length_weeks, block_items(id, item_order, block_item_weeks(week_number, exercise_id, rationale, sets, reps, hold_seconds, percent_max, frequency, prescription_mode, exercises(name_clinical)))"
      )
      .in("id", blockIds)
      .returns<BlockRow[]>();

    for (const block of blocks ?? []) {
      const sortedBlockItems = [...block.block_items].sort((a, b) => a.item_order - b.item_order);
      initialBlockDetails[block.id] = {
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
              prescription_mode: cleanPrescriptionMode(w.prescription_mode),
            })),
        })),
      };
    }
  }

  // Same "keeps referencing the same shared row" behaviour as blocks above,
  // for cardio blocks too -- not a deep copy, just fetched for inline display.
  const cardioIds = Array.from(
    new Set(initialItems.map((i) => i.cardio_block_id).filter((v): v is string => Boolean(v)))
  );
  const initialCardioBlockDetails: Record<string, CardioBlockDetail> = {};

  if (cardioIds.length > 0) {
    const { data: cardioBlocks } = await supabaseAdmin
      .from("cardio_blocks")
      .select(
        "id, name, modality, modality_other, structure, rationale, category, entry_criteria, stop_rule, tier, coaching_note, " +
          "steady_duration_seconds, steady_distance_m, " +
          "steady_intensity_percent, steady_hr_zone, steady_pace, steady_power_watts, steady_cadence, " +
          "steady_incline_resistance, interval_reps, interval_work_seconds, interval_intensities_percent, " +
          "interval_rest_mode, interval_rest_seconds, interval_rest_percent_recovered, interval_rest_type, " +
          "interval_rest_type_other"
      )
      .in("id", cardioIds)
      .returns<CardioBlockDetail[]>();

    for (const cardio of cardioBlocks ?? []) {
      initialCardioBlockDetails[cardio.id] = cardio;
    }
  }

  return (
    <div className={styles.app}>
      <div className={styles.wideInner}>
        <ClinicBrandbar />
        <h1 className={styles.heading}>Duplicate workout</h1>
        <p className={styles.subheading}>Copied from &ldquo;{workout.name}&rdquo;. Rename it and adjust as needed.</p>

        <WorkoutBuilder
          mode="create"
          workoutId={newWorkoutId}
          initialName={`${workout.name} (copy)`}
          initialHighLoad={workout.high_load}
          initialDesignations={workout.designations ?? []}
          kind={cleanWorkoutKind(workout.kind)}
          initialItems={initialItems}
          exerciseLibrary={(library ?? []) as ExerciseOption[]}
          initialBlockDetails={initialBlockDetails}
          initialCardioBlockDetails={initialCardioBlockDetails}
          defaultBlockLengthWeeks={DEFAULT_NEW_BLOCK_LENGTH_WEEKS}
        />
      </div>
    </div>
  );
}
