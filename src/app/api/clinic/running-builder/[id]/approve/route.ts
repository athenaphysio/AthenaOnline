import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { instantiateProgramme, type ProgrammeSource } from "@/lib/instantiateProgramme";
import { getPatientMembership, isActiveMembership } from "@/lib/membership";

type DraftRow = {
  id: string;
  patient_id: string;
  status: string;
  header: { goal: string; event: string | null };
  weekly_structure: { quality_runs: number; easy_runs: number; strength_sessions: number; cross_training_sessions: number };
  rules: string | null;
  weeks: number;
  quality_run_workout_id: string | null;
  easy_run_workout_id: string | null;
  strength_workout_id: string | null;
  cross_training_workout_id: string | null;
  ladder_id: string | null;
  start_rung_number: number | null;
};

// Picks the next free day 1-7 in order, wrapping and skipping days already
// taken by an earlier (higher-priority) session kind -- a calendar-spacing
// choice, not a clinical one, so a simple deterministic spread is enough.
// Caps at 7 total slots across every kind combined.
function assignDays(workoutId: string | null, count: number, usedDays: Set<number>): { workout_id: string; day_of_week: number }[] {
  if (!workoutId || count <= 0) return [];
  const result: { workout_id: string; day_of_week: number }[] = [];
  let day = 1;
  while (result.length < count && usedDays.size < 7) {
    while (usedDays.has(day)) day = day >= 7 ? 1 : day + 1;
    usedDays.add(day);
    result.push({ workout_id: workoutId, day_of_week: day });
    day = day >= 7 ? 1 : day + 1;
  }
  return result;
}

// Turns an already-built Running Builder draft into a real, patient-
// visible programme -- the same instantiateProgramme(...) call every other
// "assign to client" path in this app uses (Bespoke Build's own Send
// button, Quick Build, the Stripe webhook), so a Running Builder programme
// is indistinguishable from any other once it exists. This is the one
// point where the patient actually gains access -- nothing before this
// (the draft row, the workouts/blocks the note built) is patient-visible.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const { data: draft, error: draftError } = await supabaseAdmin
      .from("running_builder_drafts")
      .select(
        "id, patient_id, status, header, weekly_structure, rules, weeks, quality_run_workout_id, easy_run_workout_id, strength_workout_id, cross_training_workout_id, ladder_id, start_rung_number"
      )
      .eq("id", id)
      .maybeSingle<DraftRow>();
    if (draftError) throw new Error(draftError.message);
    if (!draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    if (draft.status === "approved") {
      return NextResponse.json({ error: "This draft has already been approved and assigned." }, { status: 400 });
    }

    const { data: patient, error: patientError } = await supabaseAdmin
      .from("patients")
      .select("first_name, email")
      .eq("id", draft.patient_id)
      .maybeSingle<{ first_name: string; email: string }>();
    if (patientError) throw new Error(patientError.message);
    if (!patient) return NextResponse.json({ error: "That client account no longer exists." }, { status: 400 });

    const usedDays = new Set<number>();
    const assignments = [
      ...assignDays(draft.quality_run_workout_id, draft.weekly_structure.quality_runs, usedDays),
      ...assignDays(draft.easy_run_workout_id, draft.weekly_structure.easy_runs, usedDays),
      ...assignDays(draft.strength_workout_id, draft.weekly_structure.strength_sessions, usedDays),
      ...assignDays(draft.cross_training_workout_id, draft.weekly_structure.cross_training_sessions, usedDays),
    ];

    if (assignments.length === 0) {
      return NextResponse.json(
        { error: "Nothing to assign -- this draft has no sessions in its weekly structure." },
        { status: 400 }
      );
    }

    // Same invisible membership tagging every other builder path uses --
    // Running Builder is a third door into the same Bespoke Build outcome,
    // not a separate category.
    const membership = await getPatientMembership(draft.patient_id);
    const source: ProgrammeSource = isActiveMembership(membership) ? "subscription_gated" : "clinician_assigned";

    const programmeId = crypto.randomUUID();
    const title = draft.header.event ? `${draft.header.goal} (${draft.header.event})` : draft.header.goal;

    const { emailSent, emailError } = await instantiateProgramme({
      id: programmeId,
      patientId: draft.patient_id,
      patientFirstName: patient.first_name,
      patientEmail: patient.email,
      title: title || "Running programme",
      blockLengthWeeks: draft.weeks,
      deliveryMode: "scheduled",
      assignments,
      source,
    });

    if (draft.rules) {
      const { error: notesError } = await supabaseAdmin
        .from("programme_notes")
        .insert({ programme_id: programmeId, notes: draft.rules });
      if (notesError) throw new Error(notesError.message);
    }

    // Step 4's progression tracking only starts once there's a real
    // ladder and starting rung to track -- a flagged/unmatched ladder
    // just means this client has no live running_programme_state row,
    // same as they'd have before Step 4 existed.
    if (draft.ladder_id && draft.start_rung_number != null) {
      const { error: stateError } = await supabaseAdmin.from("running_programme_state").insert({
        programme_id: programmeId,
        patient_id: draft.patient_id,
        ladder_id: draft.ladder_id,
        current_rung_number: draft.start_rung_number,
        quality_run_workout_id: draft.quality_run_workout_id,
        easy_run_workout_id: draft.easy_run_workout_id,
      });
      if (stateError) throw new Error(stateError.message);
    }

    const { error: updateError } = await supabaseAdmin
      .from("running_builder_drafts")
      .update({ status: "approved", programme_id: programmeId, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ programme_id: programmeId, patient_id: draft.patient_id, email_sent: emailSent, email_error: emailError });
  } catch (err) {
    console.error("approve running builder draft failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Approve failed: ${detail}` }, { status: 500 });
  }
}
