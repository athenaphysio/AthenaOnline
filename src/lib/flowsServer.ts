import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { FLOW_MOVE_SELECT, FLOW_SELECT, flowFromRows, type Flow } from "@/lib/flows";

export async function getFlow(id: string): Promise<Flow | null> {
  const [flowRes, movesRes] = await Promise.all([
    supabaseAdmin.from("flows").select(FLOW_SELECT).eq("id", id).maybeSingle(),
    supabaseAdmin.from("flow_moves").select(FLOW_MOVE_SELECT).eq("flow_id", id),
  ]);
  if (flowRes.error) throw new Error(`Flow query failed: ${flowRes.error.message}`);
  if (movesRes.error) throw new Error(`Flow moves query failed: ${movesRes.error.message}`);
  if (!flowRes.data) return null;
  return flowFromRows(flowRes.data, movesRes.data ?? []);
}

export async function getExerciseOptions(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabaseAdmin
    .from("exercises")
    .select("exercise_id, name_clinical")
    .order("exercise_id")
    .returns<{ exercise_id: string; name_clinical: string }[]>();
  if (error) throw new Error(`Exercise list query failed: ${error.message}`);
  return (data ?? []).map((e) => ({ id: e.exercise_id, name: e.name_clinical }));
}
