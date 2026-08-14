import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Rename only -- icon replacement already has its own endpoint
// (icon/route.ts).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as { name?: string };

  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin.from("equipment").update({ name: body.name.trim() }).eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ id });
  } catch (err) {
    console.error("rename equipment failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Rename failed: ${detail}` }, { status: 500 });
  }
}

// exercise_equipment has on delete cascade, so removing an equipment row
// untags it from every exercise automatically -- the confirmation that
// this is really what David wants happens client-side (EquipmentManagerClient
// shows the real usage count before this ever gets called), not here.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { error } = await supabaseAdmin.from("equipment").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ id });
  } catch (err) {
    console.error("delete equipment failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Delete failed: ${detail}` }, { status: 500 });
  }
}
