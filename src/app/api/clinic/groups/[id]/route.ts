import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { name } = body as { name: string };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Group name is required." }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin.from("patient_groups").update({ name: name.trim() }).eq("id", id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ id });
  } catch (err) {
    console.error("rename group failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Rename failed: ${detail}` }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    // Membership rows cascade via the FK (0021_patient_groups.sql).
    const { error } = await supabaseAdmin.from("patient_groups").delete().eq("id", id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ id });
  } catch (err) {
    console.error("delete group failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Delete failed: ${detail}` }, { status: 500 });
  }
}
