import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import PageBanner from "@/components/PageBanner";
import styles from "../../session/TodaySession.module.css";
import FormAnswerClient, { type FormQuestion } from "./FormAnswerClient";

type SendRow = { id: string; form_id: string; sent_at: string };
type ResponseRow = { id: string; submitted_at: string };
type FormRow = { title: string };
type AnswerRow = { answer_text: string | null; prompt_snapshot: string | null; question_order_snapshot: number | null };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function FormSendPage({ params }: { params: Promise<{ sendId: string }> }) {
  const { sendId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/start");
  }

  // Runs under the patient's own login -- RLS (auth.uid() = patient_id on
  // form_sends, 0022_forms.sql) guarantees this only ever resolves if the
  // send genuinely belongs to them. Anyone else's sendId simply returns
  // null here, same as a programme that isn't theirs -- not a leak, a
  // straightforward 404.
  const { data: send } = await supabase
    .from("form_sends")
    .select("id, form_id, sent_at")
    .eq("id", sendId)
    .maybeSingle<SendRow>();

  if (!send) {
    notFound();
  }

  const { data: existingResponse } = await supabase
    .from("form_responses")
    .select("id, submitted_at")
    .eq("form_send_id", sendId)
    .maybeSingle<ResponseRow>();

  // Ownership of this send is already proven above -- the rest is shared
  // clinical content (the form's own questions), fetched server-side the
  // same way the exercise library and workout content already are.
  const { data: form } = await supabaseAdmin
    .from("forms")
    .select("title")
    .eq("id", send.form_id)
    .maybeSingle<FormRow>();
  const { data: questions } = await supabaseAdmin
    .from("form_questions")
    .select("id, question_order, type, prompt, options, required")
    .eq("form_id", send.form_id)
    .order("question_order")
    .returns<FormQuestion[]>();

  const title = form?.title ?? "Form";

  if (existingResponse) {
    // Rendered from the answer's own prompt/order snapshot, not the live
    // form_questions rows -- the form may have been edited since this was
    // answered, and a submission stays exactly what the patient saw.
    const { data: answers } = await supabase
      .from("form_answers")
      .select("answer_text, prompt_snapshot, question_order_snapshot")
      .eq("form_response_id", existingResponse.id)
      .returns<AnswerRow[]>();
    const orderedAnswers = (answers ?? []).slice().sort((a, b) => (a.question_order_snapshot ?? 0) - (b.question_order_snapshot ?? 0));

    return (
      <div className={styles.app}>
        <PageBanner />
        <div className={styles.inner}>
          <div className={styles.head}>
            <div className={styles.eyebrow}>Submitted</div>
            <h1>{title}</h1>
            <p>Sent {formatDate(send.sent_at)} · completed {formatDate(existingResponse.submitted_at)}</p>
          </div>
          <div className={styles.list}>
            {orderedAnswers.map((a, i) => (
              <div key={i} className={styles.card} style={{ padding: "15px 18px" }}>
                <div style={{ fontSize: 13.5, color: "var(--stone)", marginBottom: 6 }}>{a.prompt_snapshot ?? "Question"}</div>
                <div style={{ fontSize: 15, color: "var(--charcoal)" }}>{a.answer_text || "—"}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.app}>
      <PageBanner />
      <div className={styles.inner}>
        <div className={styles.head}>
          <div className={styles.eyebrow}>A form from David</div>
          <h1>{title}</h1>
          <p>Take your time -- nothing here is timed or graded.</p>
        </div>
        <FormAnswerClient sendId={sendId} questions={questions ?? []} />
      </div>
    </div>
  );
}
