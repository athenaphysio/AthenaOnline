import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { evaluateRunProgression } from "@/lib/runningProgression";
import type { ProgressionOutcome } from "@/lib/runningProgression";

// Runs through the patient's own authenticated client -- RLS on
// run_morning_checkins (auth.uid() = patient_id, 0087_running_progression.sql)
// is the real backstop, same pattern as session/complete. The one place a
// client answers "how does it feel this morning" for a specific completed
// run -- see MorningCheckinPrompt.tsx, shown as a banner on the session
// page the day after a Run block was marked done.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { session_completion_id, answer } = body as {
    session_completion_id?: string;
    answer?: "better" | "same" | "worse";
  };
  if (!session_completion_id) {
    return NextResponse.json({ error: "session_completion_id is required." }, { status: 400 });
  }
  if (!answer || !["better", "same", "worse"].includes(answer)) {
    return NextResponse.json({ error: "answer must be better, same or worse." }, { status: 400 });
  }

  const { data: completion } = await supabase
    .from("session_completions")
    .select("id, programme_id")
    .eq("id", session_completion_id)
    .eq("patient_id", user.id)
    .eq("status", "completed")
    .not("run_stable_id", "is", null)
    .maybeSingle<{ id: string; programme_id: string }>();
  if (!completion) {
    return NextResponse.json({ error: "That run wasn't found." }, { status: 404 });
  }

  const { error } = await supabase.from("run_morning_checkins").upsert(
    {
      session_completion_id: completion.id,
      patient_id: user.id,
      programme_id: completion.programme_id,
      answer,
    },
    { onConflict: "session_completion_id", ignoreDuplicates: true }
  );
  if (error) {
    console.error("morning checkin save failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let outcome: ProgressionOutcome = { action: "none" };
  try {
    outcome = await evaluateRunProgression(completion.id);
  } catch (err) {
    // The check-in itself is already saved -- a progression-evaluation
    // failure shouldn't surface as "your answer didn't save."
    console.error("run progression evaluation failed", err);
  }

  return NextResponse.json({ ok: true, message: clientMessageForOutcome(outcome) });
}

// Encouraging, simple, and never mentions the rule or the numbers behind
// it -- straight from the brief. "ready_to_progress" reads to the client
// exactly like "no change yet," since nothing actually changes for them
// until David approves it.
function clientMessageForOutcome(outcome: ProgressionOutcome): string {
  switch (outcome.action) {
    case "progressed_automatic":
      return "Nice work. Your next session steps up a little.";
    case "dropped_back":
      return "Thank you. Let's ease off a little for the next session.";
    case "at_top":
      return "Nice work. Keep this one going.";
    case "ready_to_progress":
      return "Let's repeat this one before stepping up.";
    default:
      return "Thank you, that's noted.";
  }
}
