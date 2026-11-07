import type { ReactNode } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "@/app/clinic/patients/[id]/dashboard/ClientDashboard.module.css";
import { builderFormForTitle } from "@/lib/builderForms";
import { answersByCode, safeguardingConcern, scoreLifestyle, scoreWellbeing, type MeasureScore } from "@/lib/corporateAthlete";

// Everything sent to this client, whether it has come back, and their
// answers, scored where the form has a scoring key. Shared by the clinic's
// Forms tab (which passes the Send a form button as actions) and the coach
// portal's read only Forms tab.
export default async function FormSubmissions({ patientId: id, actions }: { patientId: string; actions?: ReactNode }) {
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
      <div className={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline", marginBottom: 10 }}>
          <h3>Forms and submissions</h3>
          {actions}
        </div>
        {(sends ?? []).length === 0 && <p className={styles.muted} style={{ margin: 0 }}>Nothing sent yet.</p>}
        {(sends ?? []).map((s) => {
          const response = responseBySend.get(s.id);
          const own = (answers ?? []).filter((a) => a.form_response_id === response?.id);
          // Lifestyle check and Wellbeing survey responses are scored
          // against the survey's scoring key, shown above the answers.
          const kind = s.forms ? builderFormForTitle(s.forms.title)?.kind : undefined;
          const plain = own.map((a) => ({ prompt: a.prompt_snapshot ?? "", answer: a.answer_text ?? "" }));
          const scores: MeasureScore[] =
            response && kind === "wellbeing" ? scoreWellbeing(answersByCode(plain)) : response && kind === "lifestyle" ? scoreLifestyle(answersByCode(plain)) : [];
          const concern = response && kind === "wellbeing" && safeguardingConcern(plain);
          return (
            <details key={s.id} style={{ borderTop: "1px solid var(--border)", padding: "12px 0" }}>
              <summary style={{ cursor: response ? "pointer" : "default", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <span>
                  <strong>{s.forms?.title ?? "Untitled form"}</strong>
                  <span className={styles.muted} style={{ fontSize: 13 }}> sent {fmt(s.sent_at)}</span>
                </span>
                {concern && <span className={`${styles.badge} ${styles.badgeWarn}`}>Safeguarding: same day review</span>}
                <span className={`${styles.badge} ${response ? styles.badgeActive : styles.badgeWarn}`}>
                  {response ? `Completed ${fmt(response.submitted_at)}` : "Waiting"}
                </span>
              </summary>
              {response && (
                <div style={{ marginTop: 12 }}>
                  {concern && (
                    <p style={{ margin: "0 0 12px", fontWeight: 600 }}>
                      PHQ-9 item 9 (thoughts of being better off dead or of self harm) was answered above zero. The survey
                      protocol asks for a same day clinical review.
                    </p>
                  )}
                  {scores.length > 0 && (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, marginBottom: 14 }}>
                      <thead>
                        <tr style={{ textAlign: "left" }}>
                          <th style={{ padding: "6px 8px 6px 0" }}>Measure</th>
                          <th style={{ padding: "6px 8px" }}>Score</th>
                          <th style={{ padding: "6px 0 6px 8px" }}>Reading</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scores.map((m) => (
                          <tr key={m.measure} style={{ borderTop: "1px solid var(--border)", verticalAlign: "top" }}>
                            <td style={{ padding: "6px 8px 6px 0" }}>
                              {m.measure}
                              <div className={styles.muted} style={{ fontSize: 12 }}>{m.items}</div>
                            </td>
                            <td style={{ padding: "6px 8px" }}>{m.score}</td>
                            <td style={{ padding: "6px 0 6px 8px" }} className={m.complete ? undefined : styles.muted}>
                              {m.interpretation}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
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
  );
}
