import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendProgrammeReadyEmail } from "@/lib/email";
import { logCommunication } from "@/lib/communications";

export type GuardianFields = {
  participant_first_name: string | null;
  participant_age: number | null;
  guardian_confirmed_at: string | null;
};

export type ProgrammeAssignment = { workout_id: string; day_of_week: number | null };

// Which of the three protection categories this programme falls into --
// required, not defaulted, so every call site has to make a conscious
// choice rather than silently inheriting whatever the last one picked.
// Only "subscription_gated" is ever touched by a lapsing membership; see
// src/lib/programmeAccess.ts.
export type ProgrammeSource = "subscription_gated" | "owned" | "clinician_assigned";

export type InstantiateProgrammeInput = {
  id: string;
  patientId: string;
  patientFirstName: string;
  patientEmail: string;
  title: string;
  blockLengthWeeks: number;
  deliveryMode: "scheduled" | "open";
  assignments: ProgrammeAssignment[];
  source: ProgrammeSource;
  sourceTemplateId?: string | null;
  audioUrl?: string | null;
  // Defaults to now() -- both "a clinic attaches a programme today" and "a
  // patient buys a programme today" mean the same thing: the block starts
  // from today, same as the column's own DB default.
  startDate?: string;
  guardianFields?: GuardianFields;
};

export type InstantiateProgrammeResult = { emailSent: boolean; emailError?: string };

// The one place a real programme gets created from copied content, called
// identically whether a clinic member is attaching a programme by hand
// (POST /api/clinic/programmes) or a patient's own purchase is fulfilling
// itself (the Stripe webhook) -- same rows, same notification, same email,
// so "buy it" and "David builds it for you" produce an indistinguishable
// result on the patient's side.
export async function instantiateProgramme(input: InstantiateProgrammeInput): Promise<InstantiateProgrammeResult> {
  const { error: programmeError } = await supabaseAdmin.from("programmes").insert({
    id: input.id,
    patient_id: input.patientId,
    patient_first_name: input.patientFirstName,
    title: input.title,
    block_length_weeks: input.blockLengthWeeks,
    audio_url: input.audioUrl ?? null,
    source: input.source,
    source_template_id: input.sourceTemplateId ?? null,
    delivery_mode: input.deliveryMode,
    start_date: input.startDate ?? new Date().toISOString(),
    participant_first_name: input.guardianFields?.participant_first_name ?? null,
    participant_age: input.guardianFields?.participant_age ?? null,
    guardian_confirmed_at: input.guardianFields?.guardian_confirmed_at ?? null,
  });
  if (programmeError) throw new Error(programmeError.message);

  if (input.assignments.length > 0) {
    const rows = input.assignments.map((a) => ({
      programme_id: input.id,
      workout_id: a.workout_id,
      day_of_week: a.day_of_week,
    }));
    const { error: assignError } = await supabaseAdmin.from("programme_workouts").insert(rows);
    if (assignError) throw new Error(assignError.message);
  }

  // The in-app notice always gets created -- it's the guaranteed way the
  // patient finds out, even if the email below fails.
  const notificationTitle = "Your programme's ready";
  const notificationBody = "Your programme is live now. Open the app to get started.";
  const { error: notificationError } = await supabaseAdmin.from("notifications").insert({
    patient_id: input.patientId,
    type: "programme_ready",
    title: notificationTitle,
    body: notificationBody,
  });
  if (notificationError) throw new Error(notificationError.message);
  await logCommunication({
    patientId: input.patientId,
    channel: "in_app",
    type: "programme_ready",
    title: notificationTitle,
    body: notificationBody,
  });

  try {
    await sendProgrammeReadyEmail(input.patientId, input.patientEmail, input.patientFirstName);
    return { emailSent: true };
  } catch (err) {
    console.error("programme ready email failed", err);
    return { emailSent: false, emailError: err instanceof Error ? err.message : String(err) };
  }
}
