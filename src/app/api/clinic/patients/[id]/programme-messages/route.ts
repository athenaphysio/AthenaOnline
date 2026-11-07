import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Switches the "Message David" line under the programme on or off for one
// client. Off by default; their brand pack can also switch it on for everyone.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { enabled } = (await request.json()) as { enabled?: boolean };
  if (typeof enabled !== "boolean") return NextResponse.json({ error: "enabled must be a boolean." }, { status: 400 });

  const { error } = await supabaseAdmin.from("patients").update({ programme_messages_enabled: enabled }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id, enabled });
}
