import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DAY_MS = 24 * 60 * 60 * 1000;

type ProgrammeRow = { start_date: string };

// Phase 6's override -- fast, one click, never touches the 6-week
// system default (instantiateProgramme.ts), only this one patient's own
// row. weeks null means "never closes" (clears access_window_weeks);
// a number means "push the closure date to N weeks from today",
// computed back onto access_window_weeks relative to the programme's own
// start_date -- a fixed +N onto the existing value wouldn't reliably
// reopen someone who's already well past their window. Resets all three
// "already sent" email flags either way, so the warning/closed/follow-up
// sequence can fire correctly against the new date rather than staying
// silently suppressed by a stale flag from the original window.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { weeks } = body as { weeks: number | null };

  try {
    let accessWindowWeeks: number | null = null;
    if (weeks !== null) {
      const { data: programme, error: fetchError } = await supabaseAdmin
        .from("programmes")
        .select("start_date")
        .eq("id", id)
        .maybeSingle<ProgrammeRow>();
      if (fetchError) throw new Error(fetchError.message);
      if (!programme) return NextResponse.json({ error: "Programme not found." }, { status: 404 });

      const targetClosureMs = Date.now() + weeks * 7 * DAY_MS;
      const startMs = new Date(programme.start_date).getTime();
      accessWindowWeeks = Math.max(1, Math.ceil((targetClosureMs - startMs) / (7 * DAY_MS)));
    }

    const { error } = await supabaseAdmin
      .from("programmes")
      .update({
        access_window_weeks: accessWindowWeeks,
        access_warning_sent_at: null,
        access_closed_email_sent_at: null,
        access_followup_sent_at: null,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, accessWindowWeeks });
  } catch (err) {
    console.error("extend access failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
