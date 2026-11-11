import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";
import { cleanCircuitExercises } from "@/lib/runCircuit";
import { friendlyCircuitError, loadCircuitLibrary } from "@/lib/runCircuitServer";

// The Run Circuit library: every block and phase set. Used by the library
// screen, by "Paste plan code" to check block names, and by the builder to
// copy a block's exercises onto a client's card.
export async function GET() {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await loadCircuitLibrary());
}

// Creates a block ({ kind: "block", name, notes, exercises }) or a phase set
// ({ kind: "set", name, notes, block_ids }).
export async function POST(request: NextRequest) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json()) as Record<string, unknown>;
  const kind = body.kind === "set" ? "set" : "block";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (!name) return NextResponse.json({ error: "Give it a name first." }, { status: 400 });

  if (kind === "block") {
    const { data, error } = await supabaseAdmin
      .from("run_circuit_blocks")
      .insert({ name, notes, exercises: cleanCircuitExercises(body.exercises) })
      .select("id")
      .single<{ id: string }>();
    if (error) return NextResponse.json({ error: friendlyCircuitError(error.message, "block") }, { status: 400 });
    return NextResponse.json({ id: data.id });
  }

  const blockIds = Array.isArray(body.block_ids) ? body.block_ids.filter((x): x is string => typeof x === "string") : [];
  const { data, error } = await supabaseAdmin
    .from("run_circuit_sets")
    .insert({ name, notes, block_ids: blockIds })
    .select("id")
    .single<{ id: string }>();
  if (error) return NextResponse.json({ error: friendlyCircuitError(error.message, "set") }, { status: 400 });
  return NextResponse.json({ id: data.id });
}
