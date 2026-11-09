import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { BuiltSession } from "@/lib/strengthEngine";

// Writes sessions from the strength engine as one programme's own
// workouts, blocks and week by week rows, exactly the shape of a client copy
// of a library session, so the builder, the client's app and the plan PDF
// treat them like any other session. Nothing is written to the library.

export type SavedSession = { key: string; id: string; name: string; high_load: boolean };

export async function saveBuiltSessions(programmeId: string, sessions: BuiltSession[], weeks: number): Promise<SavedSession[]> {
  const saved: SavedSession[] = [];
  for (const s of sessions) {
    const workoutId = crypto.randomUUID();
    const { error: wErr } = await supabaseAdmin
      .from("workouts")
      .insert({ id: workoutId, name: s.name, high_load: s.high_load, kind: "standard", programme_id: programmeId });
    if (wErr) throw new Error(wErr.message);

    try {
      for (const [bi, block] of s.blocks.entries()) {
        const blockId = crypto.randomUUID();
        const { error: bErr } = await supabaseAdmin.from("blocks").insert({
          id: blockId,
          name: block.name,
          type: block.slot,
          block_length_weeks: weeks,
          sequence_type: block.sequence,
          programme_id: programmeId,
        });
        if (bErr) throw new Error(bErr.message);
        const { error: wiErr } = await supabaseAdmin
          .from("workout_items")
          .insert({ workout_id: workoutId, item_order: bi + 1, slot_type: block.slot, block_id: blockId });
        if (wiErr) throw new Error(wiErr.message);

        const items = block.items.map((item, ii) => ({ id: crypto.randomUUID(), block_id: blockId, item_order: ii + 1, rows: item.rows }));
        if (items.length === 0) continue;
        const { error: iErr } = await supabaseAdmin.from("block_items").insert(items.map(({ id, block_id, item_order }) => ({ id, block_id, item_order })));
        if (iErr) throw new Error(iErr.message);
        const rows = items.flatMap((item) =>
          item.rows.map((r) => ({
            block_item_id: item.id,
            week_number: r.week,
            exercise_id: r.exercise_id,
            rationale: r.rationale,
            sets: r.sets,
            reps: r.reps,
            hold_seconds: r.hold_seconds,
            prescription_mode: r.prescription_mode,
          }))
        );
        const { error: rErr } = await supabaseAdmin.from("block_item_weeks").insert(rows);
        if (rErr) throw new Error(rErr.message);
      }
    } catch (err) {
      // Leave nothing half built behind.
      await supabaseAdmin.from("workouts").delete().eq("id", workoutId);
      throw err;
    }
    saved.push({ key: s.key, id: workoutId, name: s.name, high_load: s.high_load });
  }
  return saved;
}
