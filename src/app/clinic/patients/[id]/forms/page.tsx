import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClientRecordShell from "../ClientRecordShell";
import styles from "../dashboard/ClientDashboard.module.css";

export const dynamic = "force-dynamic";

// Forms: everything sent to this client, whether it has come back, and
// their answers.
export default async function FormsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: sends } = await supabaseAdmin
    .from("form_sends")
    .select("id, sent_at, forms(title)")
    .eq("patient_id", id)
    .order("sent_at", { ascending: false })
    .returns<{ id: string; sent_at: string; forms: { title: string } | null }[]>();
  const sendIds = (sends ?? []).map((s) => s.id);
  const { data: responses } = sendIds.length
    ? await supabaseAdmin
        .from("form_responses")
        .select("id, form_send_id, submitted_at")
        .in("form_send_id", sendIds)
        .returns<{ id: string; form_send_id: string; submitted_at: string }[]>()
    : { data: [] };
  const responseIds = (responses ?? []).map((r) => r.id);
  const { data: answers } = responseIds.length
    ? await supabaseAdmin
        .from("form_answers")
        .select("form_response_id, prompt_snapshot, answer_text, question_order_snapshot")
        .in("form_response_id", responseIds)
        .order("question_order_snapshot")
        .returns<{ form_response_id: string; prompt_snapshot: string; answer_text: string | null; question_order_snapshot: number }[]>()
    : { data: [] };
  const responseBySend = new Map((responses ?? []).map((r) => [r.form_send_id, r]));
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <ClientRecordShell patientId={id} active="forms">
      <div className={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline", marginBottom: 10 }}>
          <h3>Forms and submissions</h3>
          <Link href="/clinic/forms" className={`${styles.btn} ${styles.btnGhost}`}>
            Send a form
          </Link>
        </div>
        {(sends ?? []).length === 0 && <p className={styles.muted} style={{ margin: 0 }}>Nothing sent yet.</p>}
        {(sends ?? []).map((s) => {
          const response = responseBySend.get(s.id);
          const own = (answers ?? []).filter((a) => a.form_response_id === response?.id);
          return (
            <details key={s.id} style={{ borderTop: "1px solid var(--border)", padding: "12px 0" }}>
              <summary style={{ cursor: response ? "pointer" : "default", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <span>
                  <strong>{s.forms?.title ?? "Untitled form"}</strong>
                  <span className={styles.muted} style={{ fontSize: 13 }}> sent {fmt(s.sent_at)}</span>
                </span>
                <span className={`${styles.badge} ${response ? styles.badgeActive : styles.badgeWarn}`}>
                  {response ? `Completed ${fmt(response.submitted_at)}` : "Waiting"}
                </span>
              </summary>
              {response && (
                <div style={{ marginTop: 12 }}>
                  {own.length === 0 && <p className={styles.muted}>No answers recorded.</p>}
                  {own.map((a, i) => (
                    <div key={i} style={{ padding: "8px 0" }}>
                      <div className={styles.label}>{a.prompt_snapshot}</div>
                      <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{a.answer_text || "No answer"}</div>
                    </div>
                  ))}
                </div>
              )}
            </details>
          );
        })}
      </div>
    </ClientRecordShell>
  );
}
