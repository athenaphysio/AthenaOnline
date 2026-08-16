import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as { name?: string };

  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin.from("phase_tags").update({ name: body.name.trim() }).eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ id });
  } catch (err) {
    console.error("rename phase tag failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Rename failed: ${detail}` }, { status: 500 });
  }
}

// exercises.phase_id and blocks.phase_id both have on delete set null, so
// removing a phase tag simply un-classifies anything that used it rather
// than blocking the delete -- the usage count shown before this is called
// (PhaseTagManagerClient) is what makes that a safe, visible choice.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { error } = await supabaseAdmin.from("phase_tags").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ id });
  } catch (err) {
    console.error("delete phase tag failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Delete failed: ${detail}` }, { status: 500 });
  }
}
