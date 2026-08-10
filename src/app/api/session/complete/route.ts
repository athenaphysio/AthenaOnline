import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { currentWeekNumber, todayIsoWeekday } from "@/lib/programmeWeek";

type ActiveProgramme = { id: string; start_date: string; block_length_weeks: number };

// Runs through the patient's own authenticated client, never supabaseAdmin
// -- Row Level Security (auth.uid() = patient_id on session_completions,
// 0055_session_completions_status.sql) is the real backstop here, not just
// this route's own logic. patient_id and programme_id are always resolved
// server-side -- never trusted from the client. week_number/day_of_week
// default to today (the original behaviour) but can be overridden to mark
// a specific past session -- e.g. completing a missed session late -- since
// a client isn't always acting on today's own session.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    exercise_id,
    cardio_block_id,
    done,
    programme_id,
    week_number: targetWeek,
    day_of_week: targetDay,
  } = body as {
    exercise_id?: string;
    cardio_block_id?: string;
    done: boolean;
    programme_id?: string;
    week_number?: number;
    day_of_week?: number;
  };
  if (!exercise_id && !cardio_block_id) {
    return NextResponse.json({ error: "exercise_id or cardio_block_id is required." }, { status: 400 });
  }
  if (exercise_id && cardio_block_id) {
    return NextResponse.json({ error: "Only one of exercise_id or cardio_block_id may be set." }, { status: 400 });
  }
  if (targetDay !== undefined && (targetDay < 1 || targetDay > 7)) {
    return NextResponse.json({ error: "day_of_week must be between 1 and 7." }, { status: 400 });
  }
  if (targetWeek !== undefined && targetWeek < 1) {
    return NextResponse.json({ error: "week_number must be at least 1." }, { status: 400 });
  }

  // A client is now on /session/[programmeId] for a specific programme,
  // which isn't necessarily their most-recently-created one (e.g. marking
  // an older Scheduled block done while a newer Open routine also exists)
  // -- prefer the id the page itself resolved and already proved ownership
  // of, over guessing "most recent." Still re-checked against this
  // patient's own RLS-scoped rows, never trusted outright; falls back to
  // the old "most recent" behaviour if omitted.
  const programmeQuery = supabase.from("programmes").select("id, start_date, block_length_weeks").eq("patient_id", user.id);
  const { data: programme } = await (programme_id
    ? programmeQuery.eq("id", programme_id).maybeSingle<ActiveProgramme>()
    : programmeQuery.order("created_at", { ascending: false }).limit(1).maybeSingle<ActiveProgramme>());

  if (!programme) {
    return NextResponse.json({ error: "No active programme." }, { status: 400 });
  }

  const week_number = targetWeek ?? currentWeekNumber(programme.start_date, programme.block_length_weeks);
  const day_of_week = targetDay ?? todayIsoWeekday();

  try {
    if (done) {
      const { error } = await supabase.from("session_completions").upsert(
        {
          patient_id: user.id,
          programme_id: programme.id,
          exercise_id: exercise_id ?? null,
          cardio_block_id: cardio_block_id ?? null,
          week_number,
          day_of_week,
          status: "completed",
        },
        {
          onConflict: exercise_id
            ? "patient_id,programme_id,exercise_id,week_number,day_of_week"
            : "patient_id,programme_id,cardio_block_id,week_number,day_of_week",
          ignoreDuplicates: true,
        }
      );
      if (error) throw new Error(error.message);
    } else {
      let query = supabase
        .from("session_completions")
        .delete()
        .eq("patient_id", user.id)
        .eq("programme_id", programme.id)
        .eq("week_number", week_number)
        .eq("day_of_week", day_of_week)
        .eq("status", "completed");
      query = exercise_id ? query.eq("exercise_id", exercise_id) : query.eq("cardio_block_id", cardio_block_id!);
      const { error } = await query;
      if (error) throw new Error(error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("session completion toggle failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
