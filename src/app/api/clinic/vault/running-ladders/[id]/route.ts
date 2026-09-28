import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type IncomingRung = {
  repeats: number | null;
  run_portion: string | null;
  recovery: string | null;
  target_pace: string | null;
  effort_cue: string | null;
  total_running_minutes: string | null;
  notes: string | null;
};

type PatchBody = {
  name?: string;
  phase_label?: string | null;
  description?: string | null;
  active?: boolean;
  /** When present, replaces every rung on this ladder wholesale -- same
   * "resubmit the whole ordered list" convention the block builder uses
   * for its own items, rather than a per-rung reorder endpoint (nothing
   * else in this app has one either). rung_number is set here from the
   * array's own order, not sent by the client. */
  rungs?: IncomingRung[];
};

// One endpoint handles both the list page's quick edits (just `active`, or
// just `name`/`phase_label` from a future inline rename) and the ladder's
// own detail page saving everything at once (ladder fields plus the full
// rungs array) -- same shape either way, just a different subset of the
// body present.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as PatchBody;

  const ladderUpdates: Record<string, unknown> = {};
  if (body.name !== undefined) {
    if (!body.name.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    ladderUpdates.name = body.name.trim();
  }
  if (body.phase_label !== undefined) ladderUpdates.phase_label = body.phase_label?.trim() || null;
  if (body.description !== undefined) ladderUpdates.description = body.description?.trim() || null;
  if (body.active !== undefined) ladderUpdates.active = body.active;

  try {
    if (Object.keys(ladderUpdates).length > 0) {
      ladderUpdates.updated_at = new Date().toISOString();
      const { error } = await supabaseAdmin.from("running_ladders").update(ladderUpdates).eq("id", id);
      if (error) throw new Error(error.message);
    }

    if (body.rungs !== undefined) {
      const { error: deleteError } = await supabaseAdmin.from("running_rungs").delete().eq("ladder_id", id);
      if (deleteError) throw new Error(deleteError.message);

      if (body.rungs.length > 0) {
        const rows = body.rungs.map((r, i) => ({
          ladder_id: id,
          rung_number: i + 1,
          repeats: r.repeats,
          run_portion: r.run_portion,
          recovery: r.recovery,
          target_pace: r.target_pace,
          effort_cue: r.effort_cue,
          total_running_minutes: r.total_running_minutes,
          notes: r.notes,
        }));
        const { error: insertError } = await supabaseAdmin.from("running_rungs").insert(rows);
        if (insertError) throw new Error(insertError.message);
      }
    }

    return NextResponse.json({ id });
  } catch (err) {
    console.error("update running ladder failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Save failed: ${detail}` }, { status: 500 });
  }
}

// running_rungs cascades on delete (0085_running_ladders.sql), so a
// ladder's own rungs clean up automatically.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { error } = await supabaseAdmin.from("running_ladders").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ id });
  } catch (err) {
    console.error("delete running ladder failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Remove failed: ${detail}` }, { status: 500 });
  }
}
