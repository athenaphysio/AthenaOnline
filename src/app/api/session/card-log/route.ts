import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  const { programme_id, workout_id, week_number, quality, pain, note } = body as {
    programme_id?: string;
    workout_id?: string;
    week_number?: number;
    quality?: "finished" | "partial" | "not_done";
    pain?: number;
    note?: string;
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
