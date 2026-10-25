import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { SIDES, type Flow } from "@/lib/flows";

const CATEGORIES = ["neurodynamic", "everyday_task", "mobility", "breath"];
const AREAS = ["upper_limb", "lower_limb", "whole_body"];
const STATUSES = ["draft", "filmed", "live"];

// Saves a whole flow in one go: the flow row is created if new or updated if
// not, then its moves are replaced wholesale in the order given. Flows are
// short (a handful of moves), so replacing is simpler and safer than diffing.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as Partial<Flow>;

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "A flow needs a title." }, { status: 400 });
  if (!CATEGORIES.includes(body.category ?? "")) return NextResponse.json({ error: "Unknown flow type." }, { status: 400 });
  if (!AREAS.includes(body.bodyArea ?? "")) return NextResponse.json({ error: "Unknown body area." }, { status: 400 });
  if (!STATUSES.includes(body.status ?? "")) return NextResponse.json({ error: "Unknown status." }, { status: 400 });

  const moves = Array.isArray(body.moves) ? body.moves : [];
  for (const [i, m] of moves.entries()) {
    if (!m.name || !m.name.trim()) return NextResponse.json({ error: `Move ${i + 1} needs a name.` }, { status: 400 });
    if (!(Number(m.seconds) > 0)) return NextResponse.json({ error: `Move ${i + 1} needs a time in seconds.` }, { status: 400 });
    if (!SIDES.includes(m.side)) return NextResponse.json({ error: `Move ${i + 1} has an unknown side.` }, { status: 400 });
  }

  try {
    const { error: flowError } = await supabaseAdmin.from("flows").upsert({
      id,
      title,
      category: body.category,
      body_area: body.bodyArea,
      entry_point: body.entryPoint?.trim() || null,
      summary: body.summary?.trim() || null,
      status: body.status,
      vimeo_url: body.vimeoUrl?.trim() || null,
      notes: body.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    });
    if (flowError) throw new Error(flowError.message);

    const { error: deleteError } = await supabaseAdmin.from("flow_moves").delete().eq("flow_id", id);
    if (deleteError) throw new Error(deleteError.message);

    if (moves.length > 0) {
      const { error: insertError } = await supabaseAdmin.from("flow_moves").insert(
        moves.map((m, i) => ({
          flow_id: id,
          move_order: i + 1,
          name: m.name.trim(),
          seconds: Math.round(Number(m.seconds)),
          breath_seconds: Math.max(0, Math.round(Number(m.breathSeconds) || 0)),
          side: m.side,
          cue: m.cue?.trim() || null,
          exercise_id: m.exerciseId || null,
        }))
      );
      if (insertError) throw new Error(insertError.message);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("save flow failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Save failed: ${detail}` }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await supabaseAdmin.from("flows").delete().eq("id", id);
  if (error) {
    console.error("delete flow failed", error);
    return NextResponse.json({ error: `Delete failed: ${error.message}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
