import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// A block is shared content -- one block can sit inside many workouts
// across many patients at once, so "is this block in use" is never a
// single-workout question. Computed for every block in one batch (same
// technique as the Workouts list's own patientCount/templateUseCount),
// used both to decide whether a delete can proceed and to word the
// warning when it can't.
export type BlockUsage = {
  workoutCount: number;
  /** Distinct first names of real patients whose current programme
   * includes a workout that uses this block -- the specific, real-patient
   * half of the warning, not just a number. */
  patientNames: string[];
};

export async function getBlockUsageMap(): Promise<Map<string, BlockUsage>> {
  const [workoutItemsRes, programmeWorkoutsRes, patientsRes] = await Promise.all([
    supabaseAdmin
      .from("workout_items")
      .select("block_id, workout_id")
      .not("block_id", "is", null)
      .returns<{ block_id: string; workout_id: string }[]>(),
    supabaseAdmin
      .from("programme_workouts")
      .select("workout_id, programmes(patient_id)")
      .returns<{ workout_id: string; programmes: { patient_id: string } | null }[]>(),
    supabaseAdmin.from("patients").select("id, first_name").returns<{ id: string; first_name: string }[]>(),
  ]);

  for (const res of [workoutItemsRes, programmeWorkoutsRes, patientsRes]) {
    if (res.error) throw new Error(`Block usage query failed: ${res.error.message}`);
  }

  const firstNameById = new Map((patientsRes.data ?? []).map((p) => [p.id, p.first_name]));

  const workoutIdsByBlock = new Map<string, Set<string>>();
  for (const row of workoutItemsRes.data ?? []) {
    if (!workoutIdsByBlock.has(row.block_id)) workoutIdsByBlock.set(row.block_id, new Set());
    workoutIdsByBlock.get(row.block_id)!.add(row.workout_id);
  }

  const patientIdsByWorkout = new Map<string, Set<string>>();
  for (const link of programmeWorkoutsRes.data ?? []) {
    if (!link.programmes) continue;
    if (!patientIdsByWorkout.has(link.workout_id)) patientIdsByWorkout.set(link.workout_id, new Set());
    patientIdsByWorkout.get(link.workout_id)!.add(link.programmes.patient_id);
  }

  const usageByBlock = new Map<string, BlockUsage>();
  for (const [blockId, workoutIds] of workoutIdsByBlock) {
    const patientIds = new Set<string>();
    for (const workoutId of workoutIds) {
      for (const patientId of patientIdsByWorkout.get(workoutId) ?? []) patientIds.add(patientId);
    }
    usageByBlock.set(blockId, {
      workoutCount: workoutIds.size,
      patientNames: Array.from(patientIds)
        .map((id) => firstNameById.get(id))
        .filter((n): n is string => Boolean(n)),
    });
  }

  return usageByBlock;
}
