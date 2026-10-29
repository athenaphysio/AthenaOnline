import styles from "./ClientDashboard.module.css";
import type { BackgroundSummary } from "@/lib/backgroundSummary";

// Client context summary on the Overview: the summary as written from the
// consultation, then one line for each arm of Client profile.
export default function ContextSummary({ patientId, summary }: { patientId: string; summary: BackgroundSummary }) {
  const href = `/clinic/patients/${patientId}/background`;

  return (
    <div className={styles.card} style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <div>
          <span className={styles.label}>Client context summary</span>
          {summary.latest && (
            <div className={styles.muted} style={{ fontSize: 12.5, marginTop: 2 }}>
              From the {summary.latest.label}
            </div>
          )}
        </div>
        <a href={href} className={`${styles.btn} ${styles.btnGhost} ${styles.btnFeatured}`}>
          Client profile
        </a>
      </div>

      {summary.summary.length > 0 ? (
        <div style={{ marginTop: 14, maxWidth: 820 }}>
          {summary.summary.map((p, i) => (
            <p key={i} style={{ margin: i === 0 ? 0 : "10px 0 0", fontSize: 15, lineHeight: 1.65, whiteSpace: "pre-line" }}>
              {p}
            </p>
          ))}
        </div>
      ) : (
        <p className={styles.muted} style={{ margin: "12px 0 0", lineHeight: 1.6 }}>
          {summary.latest
            ? "The consultation is recorded but has no summary yet. Add the summary from your Twofold template in Client profile and it will appear here."
            : "No consultation recorded yet. Once you add the summary from your Twofold template in Client profile, it will appear here."}
        </p>
      )}

      {!summary.empty && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: 13 }}>
          {summary.arms.map((a) => (
            <a key={a.key} href={`${href}?part=${a.key}`} style={{ color: "inherit", textDecoration: "none" }}>
              <strong>{a.label}</strong> <span className={styles.muted}>{a.text}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
