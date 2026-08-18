import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanDesignations } from "@/lib/designations";
import { cleanWorkoutKind } from "@/lib/workoutKind";

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
      rationale: item.rationale,
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
