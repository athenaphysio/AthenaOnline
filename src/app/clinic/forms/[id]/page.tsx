import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../../clinic.module.css";
import FormBuilder, { type QuestionInput } from "../FormBuilder";
import SendForm from "./SendForm";
import ClinicBrandbar from "../../ClinicBrandbar";

// See the matching comment on src/app/clinic/page.tsx -- this page has no
// dynamic API to trigger dynamic rendering automatically, so without this
// it would freeze at whatever the roster looked like at build time.
export const dynamic = "force-dynamic";

type FormRow = { id: string; title: string };

type QuestionRow = {
  id: string;
  question_order: number;
  type: QuestionInput["type"];
  prompt: string;
  options: string[] | null;
  required: boolean;
};

type SendRow = {
  id: string;
  patient_id: string;
  sent_at: string;
  patients: { first_name: string; email: string } | null;
};

type ResponseRow = { form_send_id: string; submitted_at: string };

type GroupRow = { id: string; name: string };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: form } = await supabaseAdmin.from("forms").select("id, title").eq("id", id).maybeSingle<FormRow>();
  if (!form) {
    notFound();
  }

  const [{ data: questions }, { data: sends }, { data: groups }] = await Promise.all([
    supabaseAdmin
      .from("form_questions")
      .select("id, question_order, type, prompt, options, required")
      .eq("form_id", id)
      .order("question_order")
      .returns<QuestionRow[]>(),
    supabaseAdmin
      .from("form_sends")
      .select("id, patient_id, sent_at, patients(first_name, email)")
      .eq("form_id", id)
      .order("sent_at", { ascending: false })
      .returns<SendRow[]>(),
    supabaseAdmin.from("patient_groups").select("id, name").order("name").returns<GroupRow[]>(),
  ]);

  const sendIds = (sends ?? []).map((s) => s.id);
  const responsesBySend = new Map<string, string>();
  if (sendIds.length > 0) {
    const { data: responses } = await supabaseAdmin
      .from("form_responses")
      .select("form_send_id, submitted_at")
      .in("form_send_id", sendIds)
      .returns<ResponseRow[]>();
    for (const r of responses ?? []) responsesBySend.set(r.form_send_id, r.submitted_at);
  }

  // One roster row per patient -- their most recent send (sends already
  // ordered newest-first from the query above), so a check-in form sent
  // again shows the current cycle's status, not a stale earlier one.
  const latestSendByPatient = new Map<string, SendRow>();
  for (const s of sends ?? []) {
    if (!latestSendByPatient.has(s.patient_id)) latestSendByPatient.set(s.patient_id, s);
  }
  const roster = Array.from(latestSendByPatient.values());

  const initialQuestions: QuestionInput[] = (questions ?? []).map((q) => ({
    key: q.id,
    type: q.type,
    prompt: q.prompt,
    options: q.options && q.options.length > 0 ? q.options : ["", ""],
    required: q.required,
  }));

  return (
    <div className={styles.app}>
      <div className={styles.wideInner}>
        <ClinicBrandbar />
        <h1 className={styles.heading}>Edit form</h1>
        <p className={styles.subheading}>
          <Link href="/clinic/forms" className={styles.canvasLink}>
            ← Forms
          </Link>
        </p>

        <FormBuilder mode="edit" formId={form.id} initialTitle={form.title} initialQuestions={initialQuestions} />

        <SendForm formId={form.id} groups={groups ?? []} />

        <div className={styles.card}>
          <div className={styles.cardTitle}>Who's completed it</div>
          {roster.length === 0 && (
            <p className={styles.notice} style={{ marginTop: 0 }}>
              Not sent to anyone yet.
            </p>
          )}
          {roster.map((s) => {
            const completedAt = responsesBySend.get(s.id);
            return (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 0",
                  borderTop: "1px solid var(--cream)",
                }}
              >
                <div>
                  <Link href={`/clinic/patients/${s.patient_id}`} style={{ color: "var(--crimson)", fontWeight: 500 }}>
                    {s.patients?.first_name ?? "Unknown"}
                  </Link>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>Sent {formatDate(s.sent_at)}</div>
                </div>
                {completedAt ? (
                  <span className={`${styles.statusPill} ${styles.statusActive}`}>
                    Completed {formatDate(completedAt)}
                  </span>
                ) : (
                  <span className={`${styles.statusPill} ${styles.statusLapsed}`}>Not yet completed</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
