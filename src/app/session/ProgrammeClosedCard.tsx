import Link from "next/link";
import MembershipTierList from "../membership/MembershipTierList";
import styles from "./PatientDashboard.module.css";

type Props = {
  completedSessions: number;
  totalSessions: number;
  weeksIn: number;
};

// Replaces today's session (and the missed-session cards) once a
// programme's access window has closed -- see isProgrammeClosed in
// programmeAccessWindow.ts, called from page.tsx and [programmeId]/page.tsx.
// The "This week" and "Whole programme" lists stay visible below this
// (session names and status only, never the exercises inside one), per
// David's own call on how far the lock should reach.
export default function ProgrammeClosedCard({ completedSessions, totalSessions, weeksIn }: Props) {
  return (
    <>
      <div className={`${styles.card} ${styles.todayCard}`} style={{ position: "relative", overflow: "hidden" }}>
        <div
          aria-hidden
          style={{
            padding: "20px 20px 0",
            opacity: 0.3,
            filter: "blur(1.5px)",
            pointerEvents: "none",
          }}
        >
          <div className={styles.todayMeta} style={{ justifyContent: "space-between", borderBottom: "1px solid rgba(242,237,228,0.12)", paddingBottom: 10 }}>
            <span>This week&apos;s sessions</span>
            <span>✓</span>
          </div>
          <div className={styles.todayMeta} style={{ justifyContent: "space-between", borderBottom: "1px solid rgba(242,237,228,0.12)", padding: "10px 0" }}>
            <span>Exercise detail</span>
            <span>●</span>
          </div>
        </div>
        <div className={styles.todayBody} style={{ marginTop: -60 }}>
          <div className={styles.todayLabel}>Automatic</div>
          <div className={styles.todayTitle} style={{ marginTop: 10 }}>
            Your programme has ended
          </div>
          <p style={{ fontSize: 13, color: "var(--sand)", opacity: 0.85, marginTop: 8, lineHeight: 1.5 }}>
            Your exercises and session plan are paused. Choose a plan to carry on exactly where you left off.
          </p>
          {totalSessions > 0 && (
            <div
              style={{
                marginTop: 14,
                fontSize: 12.5,
                color: "var(--sand)",
                background: "rgba(242,237,228,0.08)",
                border: "1px solid rgba(242,237,228,0.15)",
                borderRadius: 10,
                padding: "10px 12px",
              }}
            >
              You completed {completedSessions} of {totalSessions} sessions across {weeksIn} week{weeksIn === 1 ? "" : "s"}. That
              progress stays on your record.
            </div>
          )}
          <a href="#plans" className={`${styles.btn} ${styles.btnPrimary}`} style={{ display: "block", marginTop: 16 }}>
            View plans to continue
          </a>
        </div>
      </div>

      <div className={styles.card}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--stone)", marginBottom: 10 }}>Still available to you</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Link
            href="/shop/free-resources"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "11px 12px",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontSize: 13,
              color: "inherit",
              textDecoration: "none",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green, #2f6b44)", flexShrink: 0 }} />
            Free Resources, guides, videos and downloads
          </Link>
          <Link
            href="/session#explore"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "11px 12px",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontSize: 13,
              color: "inherit",
              textDecoration: "none",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green, #2f6b44)", flexShrink: 0 }} />
            Explore, Atomic Sports, Athena Wellbeing and more
          </Link>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "11px 12px",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontSize: 13,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green, #2f6b44)", flexShrink: 0 }} />
            Your account and session history, below
          </div>
        </div>
      </div>

      <div id="plans" className={styles.card}>
        <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>Pick up where you left off</h3>
        <MembershipTierList />
      </div>
    </>
  );
}
