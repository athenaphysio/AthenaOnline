import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { applyRungToProgramme } from "@/lib/runningProgression";

type StateRow = {
  id: string;
  programme_id: string;
  patient_id: string;
  ladder_id: string;
  current_rung_number: number;
  quality_run_workout_id: string | null;
  easy_run_workout_id: string | null;
};

// "David can always override by choosing a rung manually from the client's
// page" -- straight from the brief. A manual pick isn't a progression
// event (nothing to approve or hold, no counters to reset), just an
// immediate rewrite of the Quality/Easy run workouts to whatever rung
// David chose, the same way an approved or automatic move does it.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { rung_number } = body as { rung_number?: number };
  if (typeof rung_number !== "number") {
    return NextResponse.json({ error: "rung_number is required." }, { status: 400 });
  }

  const { data: state, error: stateError } = await supabaseAdmin
    .from("running_programme_state")
    .select("id, programme_id, patient_id, ladder_id, current_rung_number, quality_run_workout_id, easy_run_workout_id")
    .eq("patient_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<StateRow>();
  if (stateError) {
    console.error("load running programme state failed", stateError.message);
    return NextResponse.json({ error: stateError.message }, { status: 500 });
  }
  if (!state) return NextResponse.json({ error: "This client has no running programme to update." }, { status: 400 });

  try {
    await applyRungToProgramme(state, rung_number);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: detail }, { status: 500 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("running_programme_state")
    .update({ current_rung_number: rung_number, consecutive_good_runs: 0, consecutive_worse_mornings: 0, updated_at: new Date().toISOString() })
    .eq("id", state.id);
  if (updateError) {
    console.error("update running programme state failed", updateError.message);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rung_number });
}
