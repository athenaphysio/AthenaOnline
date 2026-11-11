import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function whole(v: unknown, max: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : 0;
}

// What a client logs at the end of a Run Circuit. Only these fields are
// kept, whatever else is sent.
function cleanCircuitLog(v: unknown) {
  if (typeof v !== "object" || v === null) return null;
  const r = v as Record<string, unknown>;
  const planned = whole(r.blocks_planned, 200);
  return {
    blocks_planned: planned,
    blocks_completed: Math.min(planned, whole(r.blocks_completed, 200)),
    run_seconds: whole(r.run_seconds, 6 * 3600),
    other_cardio_seconds: whole(r.other_cardio_seconds, 6 * 3600),
    flare_up: r.flare_up === true,
    symptoms: typeof r.symptoms === "string" ? r.symptoms.trim().slice(0, 2000) : "",
    not_sure: r.not_sure === true,
  };
}

// "Mark complete" on a plan-code cardio card inside an ordinary programme.
// Runs through the client's own login, so the ownership check and the row's
// RLS policy both hold even if the body is tampered with.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { programme_id, workout_id, week_number, quality, pain, note, run_circuit } = body as {
    programme_id?: string;
    workout_id?: string;
    week_number?: number;
    quality?: "finished" | "partial" | "not_done";
    pain?: number;
    note?: string;
    run_circuit?: unknown;
  };
  if (!programme_id || !workout_id || !Number.isInteger(week_number)) {
    return NextResponse.json({ error: "programme_id, workout_id and week_number are required." }, { status: 400 });
  }
  if (quality && !["finished", "partial", "not_done"].includes(quality)) {
    return NextResponse.json({ error: "That answer isn't recognised." }, { status: 400 });
  }

  const { data: programme } = await supabase
    .from("programmes")
    .select("id")
    .eq("id", programme_id)
    .eq("patient_id", user.id)
    .maybeSingle<{ id: string }>();
  if (!programme) return NextResponse.json({ error: "Programme not found." }, { status: 404 });

  const { error } = await supabase.from("programme_card_logs").upsert(
    {
      programme_id,
      patient_id: user.id,
      workout_id,
      week_number,
      completed_quality: quality ?? null,
      pain_score: typeof pain === "number" ? Math.max(0, Math.min(10, Math.round(pain))) : null,
      note: note?.trim() || null,
      run_circuit: cleanCircuitLog(run_circuit),
      completed_at: new Date().toISOString(),
    },
    { onConflict: "programme_id,workout_id,week_number" }
  );
  if (error) {
    console.error("programme card log failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
