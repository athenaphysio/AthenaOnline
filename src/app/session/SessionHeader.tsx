import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./TodaySession.module.css";
import NotificationBell from "./NotificationBell";

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

// The one header for every patient-facing session screen: logo, wordmark
// and notification bell, then the greeting. The logo links back to /session
// -- a client's equivalent of the clickable ClinicBrandbar on the Owner
// side -- so there's always a way home from inside a session or routine.
export default function SessionHeader({ firstName, greeting = "Hello", eyebrow, subtitle, banner }: Props) {
  return (
    <>
      <div className={styles.brandbar}>
        <Link href="/session" style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Image src="/icons/athena-mark.png" alt="" width={26} height={26} />
          <div className={styles.brandname}>Athena Physio</div>
        </Link>
        <NotificationBell />
      </div>

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
