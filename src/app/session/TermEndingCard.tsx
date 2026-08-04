import Link from "next/link";
import styles from "./TodaySession.module.css";

type Props = {
  programmeId: string;
};

// Shown once, for the one week a scheduled block has exactly four weeks
// left -- a calm heads up, not a decision point. The real choice comes
// later, on the "You did it" screen once the block actually finishes
// (PostBlockDoors.tsx).
export default function TermEndingCard({ programmeId }: Props) {
  return (
    <div className={styles.card} style={{ padding: "20px 22px" }}>
      <div
        style={{
          fontFamily: "var(--font-fraunces), serif",
          fontSize: 22,
          fontWeight: 500,
          color: "var(--charcoal)",
        }}
      >
        Four weeks out.
      </div>
      <p style={{ fontSize: 14, color: "var(--stone)", lineHeight: 1.55, marginTop: 10 }}>
        Everything from here is sharpening, not building. The work&apos;s done. Now we protect it.
      </p>
      <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.55, marginTop: 12 }}>
        When you&apos;re across the line, we&apos;ll sort out what comes next. Nothing to think about yet.
      </p>
      <Link
        href={`/session/${programmeId}`}
        className={styles.continueButton}
        style={{ marginTop: 16, display: "inline-flex" }}
      >
        Back to today&apos;s session
      </Link>
    </div>
  );
}
