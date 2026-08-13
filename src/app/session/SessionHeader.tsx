import type { ReactNode } from "react";
import styles from "./TodaySession.module.css";

type Props = {
  firstName: string;
  /** Defaults to "Hello" -- deliberately time-of-day-agnostic, so it's never
   * showing "Morning" in the afternoon. */
  greeting?: string;
  /** Small label above the heading (e.g. "Today's session", "Rest day").
   * Omitted on the landing page itself, which isn't describing a state. */
  eyebrow?: string;
  /** A line under the heading -- typically the programme title. */
  subtitle?: ReactNode;
  /** An optional confirmation banner (e.g. after a Stripe redirect back),
   * rendered right below the greeting. */
  banner?: ReactNode;
};

// The greeting block for every patient-facing session screen. The
// logo/wordmark/notification-bell row that used to open this component
// has moved out to SiteBanner.tsx, a full-bleed banner rendered above
// .inner in page.tsx, rather than living inside this max-width column.
export default function SessionHeader({ firstName, greeting = "Hello", eyebrow, subtitle, banner }: Props) {
  return (
    <>
      <div className={styles.head}>
        {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
        <h1>
          {greeting}, <em>{firstName}.</em>
        </h1>
        {subtitle && <p>{subtitle}</p>}
      </div>

      {banner}
    </>
  );
}
