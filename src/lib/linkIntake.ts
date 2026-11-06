import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { builderFormForTitle } from "@/lib/builderForms";
import { findBuilderForm } from "@/lib/sendForm";
import { saveBuilderAnswersToBackground } from "@/lib/builderFormBackground";

// The Programme intake form filled in from a link rather than inside the app
// (see 0131_link_intake_submissions.sql). Submissions are matched to a client
// by email and filed into their record exactly as an in-app answer would be.

export type LinkAnswer = { question_id: string | null; prompt: string; question_order: number; answer: string };

export type LinkIntakeSubmission = {
  id: string;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  answers: LinkAnswer[];
  patient_id: string | null;
  filed_at: string | null;
};

const SUBMISSION_COLUMNS = "id, created_at, first_name, last_name, email, answers, patient_id, filed_at";

// ilike treats % and _ as wildcards, so they are escaped to match an email
// exactly (ignoring case).
function exactIlike(value: string): string {
  return value.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function findPatientIdByEmail(email: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("patients")
    .select("id")
    .ilike("email", exactIlike(email))
    .limit(1)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

// Files one submission into a client's record: answers the intake form they
// already have waiting (so its box leaves their home screen), or a new one
// if none is waiting, then adds the answers to their Client profile.
export async function fileLinkIntake(submission: LinkIntakeSubmission, patientId: string): Promise<void> {
  if (submission.filed_at) return;
  const form = await findBuilderForm("intake");
  if (!form) throw new Error("The Programme intake form is not in the Forms library.");
  const def = builderFormForTitle(form.title);

  const [{ data: sends }, { data: responses }] = await Promise.all([
    supabaseAdmin
      .from("form_sends")
      .select("id")
      .eq("patient_id", patientId)
      .eq("form_id", form.id)
      .order("sent_at")
      .returns<{ id: string }[]>(),
    supabaseAdmin.from("form_responses").select("form_send_id").eq("patient_id", patientId).returns<{ form_send_id: string }[]>(),
  ]);
  const answered = new Set((responses ?? []).map((r) => r.form_send_id));
  let sendId = (sends ?? []).find((s) => !answered.has(s.id))?.id ?? null;
  if (!sendId) {
    const { data: newSend, error } = await supabaseAdmin
      .from("form_sends")
      .insert({ form_id: form.id, patient_id: patientId, sent_at: submission.created_at })
      .select("id")
      .single<{ id: string }>();
    if (error) throw new Error(error.message);
    sendId = newSend.id;
  }

  const { data: response, error: responseError } = await supabaseAdmin
    .from("form_responses")
    .insert({ form_send_id: sendId, patient_id: patientId, submitted_at: submission.created_at })
    .select("id")
    .single<{ id: string }>();
  if (responseError) throw new Error(responseError.message);

  const rows = submission.answers.map((a) => ({
    form_response_id: response.id,
    question_id: a.question_id,
    patient_id: patientId,
    answer_text: a.answer,
    prompt_snapshot: a.prompt,
    question_order_snapshot: a.question_order,
  }));
  if (rows.length > 0) {
    const { error: answersError } = await supabaseAdmin.from("form_answers").insert(rows);
    if (answersError) throw new Error(answersError.message);
  }

  // Best effort, as for an in-app answer: the answers above are already safe.
  if (def) {
    try {
      await saveBuilderAnswersToBackground(def, patientId, rows, submission.created_at.slice(0, 10));
    } catch (err) {
      console.error("saving link intake to background failed", err);
    }
  }

  const { error: markError } = await supabaseAdmin
    .from("link_intake_submissions")
    .update({ patient_id: patientId, form_response_id: response.id, filed_at: new Date().toISOString() })
    .eq("id", submission.id);
  if (markError) throw new Error(markError.message);
}

// Files every held submission made with this email into the client's record.
// Called when a registration is confirmed into a client, so answers given
// before the client was in the app arrive with the rest of their details.
export async function fileHeldLinkIntakes(patientId: string, email: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("link_intake_submissions")
    .select(SUBMISSION_COLUMNS)
    .ilike("email", exactIlike(email))
    .is("filed_at", null)
    .order("created_at")
    .returns<LinkIntakeSubmission[]>();
  let filed = 0;
  for (const submission of data ?? []) {
    try {
      await fileLinkIntake(submission, patientId);
      filed += 1;
    } catch (err) {
      console.error("filing held link intake failed", submission.id, err);
    }
  }
  return filed;
}

// Whether this client has already answered a Programme intake form, in the
// app or from a link, so a second blank one is never sent to them.
export async function hasAnsweredIntake(patientId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("form_responses")
    .select("id, form_sends(forms(title))")
    .eq("patient_id", patientId)
    .returns<{ id: string; form_sends: { forms: { title: string } | null } | null }[]>();
  return (data ?? []).some((r) => r.form_sends?.forms && builderFormForTitle(r.form_sends.forms.title)?.kind === "intake");
}

// Submissions not yet matched to a client, newest first, for the
// Registrations page.
export async function heldLinkIntakes(): Promise<(LinkIntakeSubmission & { after_registration: boolean })[]> {
  const { data } = await supabaseAdmin
    .from("link_intake_submissions")
    .select(`${SUBMISSION_COLUMNS}, after_registration`)
    .is("filed_at", null)
    .order("created_at", { ascending: false })
    .returns<(LinkIntakeSubmission & { after_registration: boolean })[]>();
  return data ?? [];
}
