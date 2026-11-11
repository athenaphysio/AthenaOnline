import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanCircuitExercises, type CircuitLibrary, type LibraryCircuitBlock, type LibraryCircuitSet } from "@/lib/runCircuit";

type BlockRow = { id: string; name: string; notes: string; exercises: unknown; sort_order: number };
type SetRow = { id: string; name: string; notes: string; block_ids: string[] | null; sort_order: number };

// The whole Run Circuit library, with each exercise's name refreshed from
// the exercise library so a renamed exercise reads correctly everywhere.
export async function loadCircuitLibrary(): Promise<CircuitLibrary> {
  const [{ data: blockRows }, { data: setRows }] = await Promise.all([
    supabaseAdmin.from("run_circuit_blocks").select("id, name, notes, exercises, sort_order").order("sort_order").order("name").returns<BlockRow[]>(),
    supabaseAdmin.from("run_circuit_sets").select("id, name, notes, block_ids, sort_order").order("sort_order").order("name").returns<SetRow[]>(),
  ]);

  const blocks: LibraryCircuitBlock[] = (blockRows ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    notes: b.notes ?? "",
    exercises: cleanCircuitExercises(b.exercises),
  }));

  const ids = Array.from(new Set(blocks.flatMap((b) => b.exercises.map((e) => e.exercise_id))));
  if (ids.length > 0) {
    const { data: names } = await supabaseAdmin
      .from("exercises")
      .select("exercise_id, name_clinical")
      .in("exercise_id", ids)
      .returns<{ exercise_id: string; name_clinical: string | null }[]>();
    const byId = new Map((names ?? []).map((n) => [n.exercise_id, n.name_clinical ?? ""]));
    for (const b of blocks) for (const e of b.exercises) e.name = byId.get(e.exercise_id) || e.name || e.exercise_id;
  }

  const blockIds = new Set(blocks.map((b) => b.id));
  const sets: LibraryCircuitSet[] = (setRows ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    notes: s.notes ?? "",
    block_ids: (s.block_ids ?? []).filter((id) => blockIds.has(id)),
  }));

  return { blocks, sets };
}

/** Just the names, for checking plan code. */
export async function loadCircuitNames(): Promise<{ blocks: string[]; sets: string[] }> {
  const lib = await loadCircuitLibrary();
  return { blocks: lib.blocks.map((b) => b.name), sets: lib.sets.map((s) => s.name) };
}

export function friendlyCircuitError(message: string, kind: "block" | "set"): string {
  if (/duplicate key|unique/i.test(message)) {
    return kind === "block" ? "There is already a circuit block with that name. Block names need to be unique." : "There is already a phase set with that name.";
  }
  return message;
}
