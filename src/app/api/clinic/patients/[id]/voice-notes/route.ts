import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Switches voice notes on or off for one client, from their record.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { enabled } = (await request.json()) as { enabled?: boolean };
  if (typeof enabled !== "boolean") return NextResponse.json({ error: "enabled must be a boolean." }, { status: 400 });
  const { error } = await supabaseAdmin.from("patients").update({ voice_notes_enabled: enabled }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id, enabled });
}

// Marks every note for this client as read once David has seen them.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await supabaseAdmin
    .from("voice_notes")
    .update({ read_at: new Date().toISOString() })
    .eq("patient_id", id)
    .is("read_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
