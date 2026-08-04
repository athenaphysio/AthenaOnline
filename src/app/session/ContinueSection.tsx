import Link from "next/link";
import styles from "./TodaySession.module.css";
import EmptyProgrammeNotice from "./EmptyProgrammeNotice";

export type ScheduledStatus = {
  id: string;
  title: string;
  week: number;
  blockLengthWeeks: number;
  hasWorkoutToday: boolean;
};

export type OpenRoutineSummary = {
  id: string;
  title: string;
};

type Props = {
  scheduled: ScheduledStatus | null;
  /** Newest first. */
  openRoutines: OpenRoutineSummary[];
};

// The client's own space, always the first thing on the page -- a single
// primary card for whatever they're actually meant to do next, with every
// other active routine listed underneath rather than hidden. Nothing here
// ever mentions the shop.
export default function ContinueSection({ scheduled, openRoutines }: Props) {
  if (!scheduled && openRoutines.length === 0) {
    return <EmptyProgrammeNotice />;
  }

  // The Scheduled programme is always the primary card when one exists --
  // every Open routine, including what would otherwise be "the" routine,
  // becomes a secondary row. With no Scheduled programme, the most recent
  // Open routine takes the primary slot instead.
  const primaryOpen = scheduled ? null : (openRoutines[0] ?? null);
  const secondaryOpenRoutines = scheduled ? openRoutines : openRoutines.slice(1);

  return (
    <div>
      <div className={styles.continueCard}>
        {scheduled ? (
          <>
            <div className={styles.continueEyebrow}>
              {scheduled.hasWorkoutToday ? "Today's session" : "Rest day"}
            </div>
            <div className={styles.continueTitle}>{scheduled.title}</div>
            <div className={styles.continueMeta}>
              {scheduled.hasWorkoutToday
                ? `Week ${scheduled.week} of ${scheduled.blockLengthWeeks}`
                : "Nothing scheduled today. Enjoy the rest, your next session will be here when it's due."}
            </div>
            {scheduled.hasWorkoutToday && (
              <Link href={`/session/${scheduled.id}`} className={styles.continueButton}>
                Continue
              </Link>
            )}
          </>
        ) : (
          primaryOpen && (
            <>
              <div className={styles.continueEyebrow}>Your routine</div>
              <div className={styles.continueTitle}>{primaryOpen.title}</div>
              <Link href={`/session/${primaryOpen.id}`} className={styles.continueButton}>
                Continue
              </Link>
            </>
          )
        )}
      </div>

      {secondaryOpenRoutines.length > 0 && (
        <div className={styles.secondaryList}>
          {secondaryOpenRoutines.map((routine) => (
            <Link key={routine.id} href={`/session/${routine.id}`} className={styles.secondaryRow}>
              <span className={styles.secondaryRowTitle}>{routine.title}</span>
              <span className={styles.secondaryRowLink}>Continue →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
