import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanDesignations } from "@/lib/designations";
import { cleanWorkoutKind } from "@/lib/workoutKind";
import { cleanPrescriptionMode } from "@/lib/prescriptionMode";
import { cleanRunPortionUnit, cleanRunRecoveryType } from "@/lib/runBlock";

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
  prescription_mode?: string | null;
  rationale: string | null;
  is_run_block?: boolean;
  run_stable_id?: string | null;
  run_title?: string | null;
  run_warmup_walk?: string | null;
  run_repeats?: number | null;
  run_portion_value?: number | null;
  run_portion_unit?: string | null;
  run_recovery_duration?: string | null;
  run_recovery_type?: string | null;
  run_target_pace?: string | null;
  run_effort_cue?: string | null;
  run_surface?: string | null;
  run_cooldown?: string | null;
};

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { id, name, high_load, items, notes, designations, kind } = body as {
    id: string;
    name: string;
    high_load?: boolean;
    designations?: string[];
    kind?: string;
    items: IncomingItem[];
    notes?: string | null;
  };

  // items.length === 0 is allowed -- an Open programme's workout is created
  // empty up front (a real row, same as ProgrammeBuilder's own pre-generated
  // id) and filled in afterwards via this same workout's own edit/save.
  if (!id || !name || !Array.isArray(items)) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  try {
    const { error: workoutError } = await supabaseAdmin
      .from("workouts")
      .insert({
        id,
        name,
        high_load: high_load ?? false,
        designations: cleanDesignations(designations),
        kind: cleanWorkoutKind(kind),
      });
    if (workoutError) throw new Error(workoutError.message);

    if (notes) {
      const { error: notesError } = await supabaseAdmin.from("workout_notes").insert({ workout_id: id, notes });
      if (notesError) throw new Error(notesError.message);
    }

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
      prescription_mode: cleanPrescriptionMode(item.prescription_mode),
      rationale: item.rationale,
      is_run_block: item.is_run_block ?? false,
      // Only ever sent by the client for a genuine Run block; the column's
      // own default (gen_random_uuid()) covers the null case rather than
      // this route inventing one, so a stray null here never overwrites a
      // real id with a fresh one it didn't mean to.
      ...(item.run_stable_id ? { run_stable_id: item.run_stable_id } : {}),
      run_title: item.run_title ?? null,
      run_warmup_walk: item.run_warmup_walk ?? null,
      run_repeats: item.run_repeats ?? null,
      run_portion_value: item.run_portion_value ?? null,
      run_portion_unit: cleanRunPortionUnit(item.run_portion_unit),
      run_recovery_duration: item.run_recovery_duration ?? null,
      run_recovery_type: cleanRunRecoveryType(item.run_recovery_type),
      run_target_pace: item.run_target_pace ?? null,
      run_effort_cue: item.run_effort_cue ?? null,
      run_surface: item.run_surface ?? null,
      run_cooldown: item.run_cooldown ?? null,
    }));
    if (rows.length > 0) {
      const { error: itemsError } = await supabaseAdmin.from("workout_items").insert(rows);
      if (itemsError) throw new Error(itemsError.message);
    }

    return NextResponse.json({ id });
  } catch (err) {
    console.error("create workout failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Create failed: ${detail}` }, { status: 500 });
  }
}
