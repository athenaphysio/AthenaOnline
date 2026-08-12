import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { instantiateProgramme, type ProgrammeSource } from "@/lib/instantiateProgramme";
import { getPatientMembership, isActiveMembership } from "@/lib/membership";

type IncomingAssignment = {
  workout_id: string;
  day_of_week: number | null;
};

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    id,
    patient_id,
    title,
    block_length_weeks,
    audio_url,
    assignments,
    source_template_id,
    guardian_confirmed,
    participant_first_name,
    participant_age,
    delivery_mode,
    origin,
  } = body as {
    id: string;
    patient_id: string;
    title: string;
    block_length_weeks: number;
    audio_url: string | null;
    assignments: IncomingAssignment[];
    source_template_id?: string | null;
    guardian_confirmed?: boolean;
    participant_first_name?: string;
    participant_age?: number;
    delivery_mode?: "scheduled" | "open";
    // "quick_assign" (always a free gift, never gated) or "builder"
    // (Bespoke Build or Quick Build, tagged from live membership status).
    origin?: "quick_assign" | "builder";
  };

  if (!id || !patient_id || !title || !block_length_weeks || !Array.isArray(assignments)) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  try {
    const { data: patient, error: patientError } = await supabaseAdmin
      .from("patients")
      .select("first_name, email")
      .eq("id", patient_id)
      .maybeSingle();

    if (patientError) throw new Error(patientError.message);
    if (!patient) {
      return NextResponse.json({ error: "That patient account no longer exists." }, { status: 400 });
    }

    // Guardian confirmation is a compliance requirement, not a UI nicety --
    // re-check the template's own flag server-side rather than trusting
    // whatever the client claims about it. Never store participant data
    // for a programme whose template isn't actually flagged, even if a
    // client sent some.
    let isUnder18 = false;
    // Phases have no nested content of their own (just name + week range),
    // so a plain copy here is enough -- no deep-copy needed, unlike
    // workouts/blocks (see copyProgrammeContent.ts).
    let templatePhases: { name: string; start_week: number; end_week: number; sort_order: number }[] = [];
    if (source_template_id) {
      const { data: template, error: templateError } = await supabaseAdmin
        .from("programme_templates")
        .select("is_under_18, programme_template_phases(name, start_week, end_week, sort_order)")
        .eq("id", source_template_id)
        .maybeSingle<{
          is_under_18: boolean;
          programme_template_phases: { name: string; start_week: number; end_week: number; sort_order: number }[];
        }>();
      if (templateError) throw new Error(templateError.message);
      isUnder18 = template?.is_under_18 ?? false;
      templatePhases = template?.programme_template_phases ?? [];
    }

    let guardianFields: { participant_first_name: string | null; participant_age: number | null; guardian_confirmed_at: string | null };
    if (isUnder18) {
      const age = Number(participant_age);
      if (!guardian_confirmed || !participant_first_name?.trim() || !Number.isInteger(age) || age < 1 || age > 17) {
        return NextResponse.json(
          { error: "This is an under-18 programme -- guardian confirmation and the participant's first name and age are required." },
          { status: 400 }
        );
      }
      guardianFields = {
        participant_first_name: participant_first_name.trim(),
        participant_age: age,
        guardian_confirmed_at: new Date().toISOString(),
      };
    } else {
      guardianFields = { participant_first_name: null, participant_age: null, guardian_confirmed_at: null };
    }

    // Quick Assign is always a free gift, by design -- never gated on
    // membership regardless of what the patient's status is. Everything
    // else (Bespoke Build, Quick Build) tags itself invisibly from the
    // patient's live membership status at this exact moment: no question,
    // no toggle, David never has to think about it while building.
    let source: ProgrammeSource;
    if (origin === "quick_assign") {
      source = "clinician_assigned";
    } else {
      const membership = await getPatientMembership(patient_id);
      source = isActiveMembership(membership) ? "subscription_gated" : "clinician_assigned";
    }

    const { emailSent, emailError } = await instantiateProgramme({
      id,
      patientId: patient_id,
      patientFirstName: patient.first_name,
      patientEmail: patient.email,
      title,
      blockLengthWeeks: block_length_weeks,
      deliveryMode: delivery_mode ?? "scheduled",
      assignments,
      phases: templatePhases,
      source,
      sourceTemplateId: source_template_id ?? null,
      audioUrl: audio_url ?? null,
      guardianFields,
    });

    return NextResponse.json({ id, email_sent: emailSent, email_error: emailError });
  } catch (err) {
    console.error("create programme failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Create failed: ${detail}` }, { status: 500 });
  }
}
