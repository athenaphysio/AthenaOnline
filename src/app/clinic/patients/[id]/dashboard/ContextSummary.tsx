import styles from "./ClientDashboard.module.css";
import type { BackgroundSummary } from "@/lib/backgroundSummary";

// Client context summary on the Overview: a short passage written from what
// is recorded in Client background, with any red flags shown above it.
export default function ContextSummary({ patientId, summary }: { patientId: string; summary: BackgroundSummary }) {
  const href = `/clinic/patients/${patientId}/background`;

  return (
    <div className={styles.card} style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <span className={styles.label}>Client context summary</span>
        <a href={href} className={`${styles.btn} ${styles.btnGhost}`}>
          Client background
        </a>
      </div>

      {summary.redFlags.length > 0 && (
        <div
          role="alert"
          style={{ marginTop: 14, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--tone-bad)", background: "rgba(155, 28, 28, 0.12)" }}
        >
          <strong style={{ color: "var(--tone-bad)" }}>Needs clinical review</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {summary.redFlags.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.empty ? (
        <p className={styles.muted} style={{ margin: "12px 0 0" }}>
          Nothing in Client background yet. Once a consultation, passport results or a questionnaire is added, a short
          summary of them appears here.
        </p>
      ) : (
        <div style={{ marginTop: 14, maxWidth: 820 }}>
          {summary.paragraphs.map((p, i) => (
            <p key={i} style={{ margin: i === 0 ? 0 : "10px 0 0", fontSize: 15, lineHeight: 1.65 }}>
              {p}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
