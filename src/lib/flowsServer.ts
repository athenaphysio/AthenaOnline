import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { FLOW_MOVE_SELECT, FLOW_SELECT, flowFromRows, type Flow } from "@/lib/flows";
import { armForFlow } from "@/lib/tools";

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

// The live Flows the Tools tab can show, each with its moves. Only Flows
// marked "Live for clients" in the Vault ever reach a client; drafts and
// filmed but unreleased Flows stay in the clinic.
export async function getLiveToolFlows(): Promise<Flow[]> {
  const { data: flows, error } = await supabaseAdmin.from("flows").select(FLOW_SELECT).eq("status", "live").order("sort_order").order("title");
  if (error) throw new Error(`Tools query failed: ${error.message}`);
  const shown = (flows ?? []).filter((f) => armForFlow(flowFromRows(f, [])));
  if (shown.length === 0) return [];
  const { data: moves, error: movesError } = await supabaseAdmin
    .from("flow_moves")
    .select(FLOW_MOVE_SELECT)
    .in(
      "flow_id",
      shown.map((f) => f.id),
    );
  if (movesError) throw new Error(`Tools moves query failed: ${movesError.message}`);
  return shown.map((f) => flowFromRows(f, (moves ?? []).filter((m) => m.flow_id === f.id)));
}

// One live Flow for the Tools player, or null if it is not live or not in
// a Tools area, so a client can never open a draft by guessing its address.
export async function getLiveToolFlow(id: string): Promise<Flow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const flow = await getFlow(id);
  if (!flow || flow.status !== "live" || !armForFlow(flow)) return null;
  return flow;
}
