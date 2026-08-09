import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getPatientMembership, isActiveMembership } from "@/lib/membership";
import { logCommunication } from "@/lib/communications";
import { sendNewMessageAlertEmail } from "@/lib/email";

// The exact wording from claude_code_instructions_intake_and_messaging.md --
// system-toned, never first person, no apology, no invitation to reply.
export const MESSAGE_LIMIT_NOTICE =
  "This programme includes one message to your clinician. Further messaging is available through Athena membership plans.";

export type PatientMessage = {
  id: string;
  sender: "patient" | "clinician";
  body: string;
  created_at: string;
  read_at: string | null;
};

// Every message in this patient's own thread for one specific programme --
// what the patient-facing composer shows. The clinic side reads across all
// of a patient's programmes instead (see the dashboard/inbox routes),
// since Owner's view is patient-centric, not programme-centric.
export async function getProgrammeMessages(programmeId: string): Promise<PatientMessage[]> {
  const { data, error } = await supabaseAdmin
    .from("patient_messages")
    .select("id, sender, body, created_at, read_at")
    .eq("programme_id", programmeId)
    .order("created_at", { ascending: true })
    .returns<PatientMessage[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type SendResult = { delivered: true; message: PatientMessage } | { delivered: false; notice: string };

// The one place the gate actually runs. Any active paid membership tier
// (Member and above -- Member's own tier copy already promises "Message me
// when something flares", so the free-message limit is really "no
// membership at all", not the old spec's now-superseded tier names) skips
// the counter entirely. Everyone else gets exactly one message per
// programme; a second attempt never reaches David.
export async function sendPatientMessage(params: {
  patientId: string;
  programmeId: string;
  body: string;
}): Promise<SendResult> {
  const { patientId, programmeId, body } = params;
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Message can't be empty.");

  const membership = await getPatientMembership(patientId);
  const unlimited = isActiveMembership(membership);

  if (!unlimited) {
    const { data: programme, error: programmeError } = await supabaseAdmin
      .from("programmes")
      .select("free_message_used_at")
      .eq("id", programmeId)
      .maybeSingle<{ free_message_used_at: string | null }>();
    if (programmeError) throw new Error(programmeError.message);

    if (programme?.free_message_used_at) {
      // Gated -- never reaches David, never emails him. Logged only for
      // the aggregate "hit their limit this week" signal Phase 3 asks
      // for, not as anything he sees or acts on per-event.
      await logCommunication({
        patientId,
        channel: "in_app",
        type: "message_limit_reached",
        title: "Message limit reached",
        body: trimmed,
      });
      return { delivered: false, notice: MESSAGE_LIMIT_NOTICE };
    }
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("patient_messages")
    .insert({ patient_id: patientId, programme_id: programmeId, sender: "patient", body: trimmed })
    .select("id, sender, body, created_at, read_at")
    .single<PatientMessage>();
  if (insertError) throw new Error(insertError.message);

  if (!unlimited) {
    const { error: markError } = await supabaseAdmin
      .from("programmes")
      .update({ free_message_used_at: new Date().toISOString() })
      .eq("id", programmeId);
    if (markError) console.error("failed to mark free message used", markError.message);
  }

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("first_name, last_name")
    .eq("id", patientId)
    .maybeSingle<{ first_name: string; last_name: string | null }>();
  const patientName = patient ? `${patient.first_name}${patient.last_name ? ` ${patient.last_name}` : ""}` : "A patient";

  try {
    await sendNewMessageAlertEmail(patientName, trimmed, patientId);
  } catch (err) {
    // Best-effort, same reasoning as every other notification send in this
    // app -- a failed email should never fail the message itself, which is
    // already safely stored either way.
    console.error("new message alert email failed", err);
  }

  return { delivered: true, message: inserted };
}

// David's reply -- no gate, never has been ("David replies normally, in
// his own voice, exactly as today" per the spec).
export async function sendClinicianReply(params: {
  patientId: string;
  programmeId: string;
  body: string;
}): Promise<PatientMessage> {
  const trimmed = params.body.trim();
  if (!trimmed) throw new Error("Message can't be empty.");

  const { data, error } = await supabaseAdmin
    .from("patient_messages")
    .insert({ patient_id: params.patientId, programme_id: params.programmeId, sender: "clinician", body: trimmed })
    .select("id, sender, body, created_at, read_at")
    .single<PatientMessage>();
  if (error) throw new Error(error.message);
  return data;
}
