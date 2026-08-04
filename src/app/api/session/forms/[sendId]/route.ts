import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type IncomingAnswer = { question_id: string; answer_text: string };

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

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("form submission failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
