import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startFlare } from "@/lib/runningFlareUp";

// Runs through the patient's own authenticated client to prove ownership
// of the programme, same as session/complete -- the actual writes then go
// through startFlare() via supabaseAdmin, since a client has no RLS access
// to running_flare_events/programme_day_overrides (clinic-only tables).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { programme_id } = await request.json();
  if (!programme_id) {
    return NextResponse.json({ error: "programme_id is required." }, { status: 400 });
  }

  const { data: programme } = await supabase
    .from("programmes")
    .select("id")
    .eq("id", programme_id)
    .eq("patient_id", user.id)
    .maybeSingle<{ id: string }>();
  if (!programme) {
    return NextResponse.json({ error: "Programme not found." }, { status: 404 });
  }

  const result = await startFlare(programme_id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
