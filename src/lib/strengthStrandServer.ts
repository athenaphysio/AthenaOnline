import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Strand } from "@/lib/rowing/onTarget";
import type { StrengthLog } from "@/lib/strengthSuggestions";
import { strengthStrand } from "@/lib/strengthStrand";

/** The strength line for one programme, read from the client's strength logs. */
export async function strengthStrandFor(programmeId: string): Promise<Strand> {
  const { data: logs } = await supabaseAdmin
    .from("strength_logs")
    .select("id, exercise_id, week_number, day_of_week, weight_kg, reps_done, seconds_done, effort, pain, not_sure, note, logged_at")
    .eq("programme_id", programmeId)
    .returns<StrengthLog[]>();
  const ids = Array.from(new Set((logs ?? []).map((l) => l.exercise_id)));
  const { data: ex } = ids.length
    ? await supabaseAdmin
        .from("exercises")
        .select("exercise_id, name_clinical, name_patient_facing")
        .in("exercise_id", ids)
        .returns<{ exercise_id: string; name_clinical: string | null; name_patient_facing: string | null }[]>()
    : { data: [] };
  const names = new Map((ex ?? []).map((e) => [e.exercise_id, e.name_patient_facing || e.name_clinical || e.exercise_id]));
  return strengthStrand(logs ?? [], names);
}
