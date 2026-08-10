import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ActiveProgramme = { id: string };

// Mirrors /api/session/complete's shape and trust model, but at the whole-
// session level rather than per item -- a skip has no exercise_id/
// cardio_block_id, it marks an entire week/day as skipped. week_number and
// day_of_week are always required here (unlike /complete, which defaults
// to today): skipping is just as often about a specific missed session
// from earlier in the week as it is about today's own.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { skipped, programme_id, week_number, day_of_week } = body as {
    skipped: boolean;
    programme_id?: string;
    week_number: number;
    day_of_week: number;
  };

  if (!Number.isInteger(week_number) || week_number < 1) {
    return NextResponse.json({ error: "week_number must be at least 1." }, { status: 400 });
  }
  if (!Number.isInteger(day_of_week) || day_of_week < 1 || day_of_week > 7) {
    return NextResponse.json({ error: "day_of_week must be between 1 and 7." }, { status: 400 });
  }

  const programmeQuery = supabase.from("programmes").select("id").eq("patient_id", user.id);
  const { data: programme } = await (programme_id
    ? programmeQuery.eq("id", programme_id).maybeSingle<ActiveProgramme>()
    : programmeQuery.order("created_at", { ascending: false }).limit(1).maybeSingle<ActiveProgramme>());

  if (!programme) {
    return NextResponse.json({ error: "No active programme." }, { status: 400 });
  }

  try {
    if (skipped) {
      const { error } = await supabase.from("session_completions").upsert(
        {
          patient_id: user.id,
          programme_id: programme.id,
          exercise_id: null,
          cardio_block_id: null,
          week_number,
          day_of_week,
          status: "skipped",
        },
        {
          onConflict: "patient_id,programme_id,week_number,day_of_week",
          ignoreDuplicates: true,
        }
      );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("session_completions")
        .delete()
        .eq("patient_id", user.id)
        .eq("programme_id", programme.id)
        .eq("week_number", week_number)
        .eq("day_of_week", day_of_week)
        .eq("status", "skipped");
      if (error) throw new Error(error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("session skip toggle failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
