import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Removes the sample data from one client's account: every programme marked
// as a sample (its sessions, completions, logs and diary slots go with it)
// and the sample voice notes. Nothing the client entered is touched.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const notes = await supabaseAdmin.from("voice_notes").delete().eq("patient_id", id).eq("is_sample", true);
  if (notes.error) return NextResponse.json({ error: notes.error.message }, { status: 500 });
  const programmes = await supabaseAdmin.from("programmes").delete().eq("patient_id", id).eq("is_sample", true);
  if (programmes.error) return NextResponse.json({ error: programmes.error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
