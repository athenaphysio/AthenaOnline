import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { applyRungToProgramme } from "@/lib/runningProgression";

type EventRow = {
  id: string;
  programme_state_id: string;
  status: string;
  from_rung_number: number;
  to_rung_number: number;
};

type StateRow = {
  id: string;
  programme_id: string;
  patient_id: string;
  ladder_id: string;
  current_rung_number: number;
  quality_run_workout_id: string | null;
  easy_run_workout_id: string | null;
};

// David's Approve / Hold action on one pending "ready to move up" event --
// see src/app/clinic/running-progression/page.tsx. Approve actually writes
// the new rung onto the Quality/Easy run workouts (the same helper
// automatic-mode progression uses); Hold just resolves the event with
// nothing changed, and the two-good-runs count starts fresh from here.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { action } = body as { action?: "approve" | "hold" };
  if (action !== "approve" && action !== "hold") {
    return NextResponse.json({ error: "action must be approve or hold." }, { status: 400 });
  }

  try {
    const { data: event, error: eventError } = await supabaseAdmin
      .from("running_progression_events")
      .select("id, programme_state_id, status, from_rung_number, to_rung_number")
      .eq("id", id)
      .maybeSingle<EventRow>();
    if (eventError) throw new Error(eventError.message);
    if (!event) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (event.status !== "pending") {
      return NextResponse.json({ error: "This has already been resolved." }, { status: 400 });
    }

    if (action === "approve") {
      const { data: state, error: stateError } = await supabaseAdmin
        .from("running_programme_state")
        .select("id, programme_id, patient_id, ladder_id, current_rung_number, quality_run_workout_id, easy_run_workout_id")
        .eq("id", event.programme_state_id)
        .maybeSingle<StateRow>();
      if (stateError) throw new Error(stateError.message);
      if (!state) return NextResponse.json({ error: "That client's running programme no longer exists." }, { status: 400 });

      await applyRungToProgramme(state, event.to_rung_number);

      const { error: updateStateError } = await supabaseAdmin
        .from("running_programme_state")
        .update({ current_rung_number: event.to_rung_number, updated_at: new Date().toISOString() })
        .eq("id", state.id);
      if (updateStateError) throw new Error(updateStateError.message);
    }

    const { error: resolveError } = await supabaseAdmin
      .from("running_progression_events")
      .update({ status: action === "approve" ? "approved" : "held", resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (resolveError) throw new Error(resolveError.message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("running progression action failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
