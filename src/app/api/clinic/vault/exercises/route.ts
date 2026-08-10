import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  parseExerciseFields,
  parseBodyPartIds,
  parseEquipmentIds,
  nextExerciseId,
  syncExerciseBodyParts,
  syncExerciseEquipment,
} from "@/lib/vaultExercise";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const fields = parseExerciseFields(body);
  if ("error" in fields) {
    return NextResponse.json({ error: fields.error }, { status: 400 });
  }
  const bodyPartIds = parseBodyPartIds(body);
  const equipmentIds = parseEquipmentIds(body);

  try {
    const exerciseId = await nextExerciseId();
    const { error } = await supabaseAdmin.from("exercises").insert({
      exercise_id: exerciseId,
      active: true,
      ...fields,
    });
    if (error) throw new Error(error.message);

    await syncExerciseBodyParts(exerciseId, bodyPartIds);
    await syncExerciseEquipment(exerciseId, equipmentIds);

    return NextResponse.json({ exercise_id: exerciseId });
  } catch (err) {
    console.error("create vault exercise failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Save failed: ${detail}` }, { status: 500 });
  }
}
