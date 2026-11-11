import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { builderFormForTitle } from "@/lib/builderForms";
import { saveBuilderAnswersToBackground } from "@/lib/builderFormBackground";
import { safeguardingConcern } from "@/lib/corporateAthlete";
import { raiseSafeguardingAlert } from "@/lib/safeguarding";
import { saveQuestionnaireScoresToPassport } from "@/lib/questionnairePassport";

type IncomingAnswer = { question_id: string; answer_text: string };

async function saveBuilderFormToBackground(
  sendId: string,
  patientId: string,
  rows: { answer_text: string; prompt_snapshot: string | null; question_order_snapshot: number | null }[]
): Promise<void> {
  const { data: send } = await supabaseAdmin
    .from("form_sends")
    .select("forms(title)")
    .eq("id", sendId)
    .maybeSingle<{ forms: { title: string } | null }>();
  const def = send?.forms ? builderFormForTitle(send.forms.title) : null;
  if (!def) return;
  await saveBuilderAnswersToBackground(def, patientId, rows);
}

// Runs through the patient's own authenticated client, never supabaseAdmin
// -- Row Level Security (auth.uid() = patient_id on form_sends/
// form_responses/form_answers, 0022_forms.sql) is the real backstop here,
// same pattern as /api/session/complete. patient_id is resolved server-side
// from the session, never trusted from the client; the send lookup below
// only ever returns a row if RLS already agrees it's this patient's own.
export async function POST(request: NextRequest, { params }: { params: Promise<{ sendId: string }> }) {
  const { sendId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { answers } = body as { answers: IncomingAnswer[] };
  if (!Array.isArray(answers) || answers.length === 0) {
    return NextResponse.json({ error: "At least one answer is required." }, { status: 400 });
  }

  const { data: send } = await supabase.from("form_sends").select("id").eq("id", sendId).maybeSingle();
  if (!send) {
    return NextResponse.json({ error: "That form isn't available." }, { status: 404 });
  }

  try {
    const { data: responseRow, error: responseError } = await supabase
      .from("form_responses")
      .insert({ form_send_id: sendId, patient_id: user.id })
      .select("id")
      .single();
    if (responseError) {
      if (responseError.code === "23505") {
        return NextResponse.json({ error: "This form has already been submitted." }, { status: 409 });
      }
      throw new Error(responseError.message);
    }

    // Snapshot the prompt/order at answer time -- form_answers.question_id
    // has no live-content read policy for the patient's own client (forms/
    // form_questions are Owner-only), and the form itself may be edited
    // later, so display can't depend on the live row still matching what
    // was actually asked.
    const { data: questionRows } = await supabaseAdmin
      .from("form_questions")
      .select("id, prompt, question_order")
      .in(
        "id",
        answers.map((a) => a.question_id)
      )
      .returns<{ id: string; prompt: string; question_order: number }[]>();
    const questionById = new Map((questionRows ?? []).map((q) => [q.id, q]));

    const rows = answers.map((a) => ({
      form_response_id: responseRow.id,
      question_id: a.question_id,
      patient_id: user.id,
      answer_text: a.answer_text,
      prompt_snapshot: questionById.get(a.question_id)?.prompt ?? null,
      question_order_snapshot: questionById.get(a.question_id)?.question_order ?? null,
    }));
    const { error: answersError } = await supabase.from("form_answers").insert(rows);
    if (answersError) throw new Error(answersError.message);

    // Programme Builder forms are also saved to the client's background,
    // so the "Copy for Programme Builder" button picks them up alongside
    // the Twofold notes. Best effort: the answers above are already safe,
    // so a problem here never fails the client's submission.
    try {
      await saveBuilderFormToBackground(sendId, user.id, rows);
    } catch (err) {
      console.error("saving builder form to background failed", err);
    }

    // The Wellbeing survey's PHQ-9 self harm item answered above zero alerts
    // the clinical team at once for same day review. Recorded and emailed
    // before the client sees their confirmation, and kept on the clinic
    // home page until a clinician marks it as reviewed.
    const answered = rows.map((r) => ({ prompt: r.prompt_snapshot ?? "", answer: r.answer_text ?? "" }));
    const { data: sendRow } = await supabaseAdmin
      .from("form_sends")
      .select("forms(title)")
      .eq("id", sendId)
      .maybeSingle<{ forms: { title: string } | null }>();
    const formTitle = sendRow?.forms?.title ?? null;
    if (safeguardingConcern(answered)) {
      await raiseSafeguardingAlert(user.id, responseRow.id, formTitle);
    }

    // Questionnaire scores go into the client's Human Passport as drafts.
    // Best effort: the answers above are already safe.
    if (formTitle) {
      try {
        await saveQuestionnaireScoresToPassport(user.id, formTitle, answered);
      } catch (err) {
        console.error("saving questionnaire scores to passport failed", err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("form submission failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
