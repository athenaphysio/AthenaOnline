import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";
import { cleanCircuitExercises } from "@/lib/runCircuit";
import { friendlyCircuitError } from "@/lib/runCircuitServer";

// Updates a block or a phase set. Also what "Save as default" in the
// programme builder calls, with just the block's exercises. Changing a
// library block never touches a programme already built: each client's
// card holds its own copy.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const kind = body.kind === "set" ? "set" : "block";

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "The name can't be empty." }, { status: 400 });
    patch.name = name;
  }
  if (typeof body.notes === "string") patch.notes = body.notes.trim();
  if (kind === "block" && body.exercises !== undefined) patch.exercises = cleanCircuitExercises(body.exercises);
  if (kind === "set" && Array.isArray(body.block_ids)) patch.block_ids = body.block_ids.filter((x): x is string => typeof x === "string");

  const table = kind === "block" ? "run_circuit_blocks" : "run_circuit_sets";
  const { data, error } = await supabaseAdmin.from(table).update(patch).eq("id", id).select("id");
  if (error) return NextResponse.json({ error: friendlyCircuitError(error.message, kind) }, { status: 400 });
  if (!data || data.length === 0) return NextResponse.json({ error: "That is no longer in the library." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const kind = request.nextUrl.searchParams.get("kind") === "set" ? "set" : "block";

  if (kind === "set") {
    const { error } = await supabaseAdmin.from("run_circuit_sets").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Take the block out of any phase set it sits in, then remove it.
  const { data: sets } = await supabaseAdmin
    .from("run_circuit_sets")
    .select("id, block_ids")
    .contains("block_ids", [id])
    .returns<{ id: string; block_ids: string[] }[]>();
  for (const s of sets ?? []) {
    await supabaseAdmin
      .from("run_circuit_sets")
      .update({ block_ids: s.block_ids.filter((b) => b !== id), updated_at: new Date().toISOString() })
      .eq("id", s.id);
  }
  const { error } = await supabaseAdmin.from("run_circuit_blocks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
