import styles from "./ClientDashboard.module.css";
import type { ContextEntry } from "@/lib/clientBackground";
import { timepointLabel } from "@/lib/passport";

// The heart of the client's background on the Overview: their anchor
// statement and goals in their own words, the agreed first action, and any
// flags from the consultation, so the plan is always read against them.
export default function ContextSummary({ patientId, entry }: { patientId: string; entry: ContextEntry | null }) {
  const href = `/clinic/patients/${patientId}/background`;

  if (!entry) {
    return (
      <div className={styles.card} style={{ marginBottom: 22 }}>
        <span className={styles.label}>Client context</span>
        <p className={styles.muted} style={{ margin: "10px 0 0" }}>
          No consultation recorded yet.{" "}
          <a href={href} style={{ color: "var(--tone-bad)" }}>
            Add it in Client background
          </a>{" "}
          and the anchor statement, goals, first action and any flags will show here.
        </p>
      </div>
    );
  }

  const c = entry.content;
  const redFlags = c.flags.filter((f) => f.kind === "red_flag");
  const otherFlags = c.flags.filter((f) => f.kind !== "red_flag");
  const consulted = new Date(entry.consulted_on).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className={styles.card} style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <span className={styles.label}>
          Client context, {timepointLabel(entry.timepoint).toLowerCase()} consultation, {consulted}
        </span>
        <a href={href} className={`${styles.btn} ${styles.btnGhost}`}>
          Client background
        </a>
      </div>

      {redFlags.length > 0 && (
        <div
          role="alert"
          style={{ marginTop: 14, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--tone-bad)", background: "rgba(155, 28, 28, 0.12)" }}
        >
          <strong style={{ color: "var(--tone-bad)" }}>Needs clinical review</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {redFlags.map((f, i) => (
              <li key={i}>{f.text}</li>
            ))}
          </ul>
        </div>
      )}

      {c.anchor_statement && (
        <blockquote
          style={{
            margin: "16px 0 0",
            padding: "4px 0 4px 16px",
            borderLeft: "3px solid var(--crimson)",
            fontFamily: "var(--font-fraunces), serif",
            fontSize: 21,
            lineHeight: 1.4,
          }}
        >
          &ldquo;{c.anchor_statement}&rdquo;
        </blockquote>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18, marginTop: 18 }}>
        {c.goals.length > 0 && (
          <div>
            <span className={styles.label}>Goals</span>
            <ol style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.5 }}>
              {c.goals.map((g, i) => (
                <li key={i} style={{ marginBottom: 6 }}>
                  {g.goal}
                  {g.value && <div className={styles.muted} style={{ fontSize: 12.5 }}>Because {g.value}</div>}
                </li>
              ))}
            </ol>
          </div>
        )}
        {c.top_priority && (
          <div>
            <span className={styles.label}>Top priority</span>
            <div className={styles.val} style={{ marginTop: 8 }}>{c.top_priority}</div>
          </div>
        )}
        {c.first_action && (
          <div>
            <span className={styles.label}>First action</span>
            <div className={styles.val} style={{ marginTop: 8 }}>{c.first_action}</div>
          </div>
        )}
        {otherFlags.length > 0 && (
          <div>
            <span className={styles.label}>Flags and referrals</span>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.5 }}>
              {otherFlags.map((f, i) => (
                <li key={i} style={{ color: f.kind === "referral" ? "var(--tone-warn)" : undefined }}>
                  {f.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
