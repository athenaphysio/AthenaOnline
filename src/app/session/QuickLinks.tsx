import Link from "next/link";
import styles from "./TodaySession.module.css";

// Three full-width secondary actions, sat directly under the client's own
// active-programme area on the landing page (never above it) and above
// Explore. Book is styled distinctly from the other two -- it's the one
// action that sends someone out of the app entirely, to a third party
// booking system, so it reads as a different kind of action rather than
// just a different label.
export default function QuickLinks() {
  return (
    <div className={styles.quickLinks}>
      <Link href="/about" className={styles.quickLinkButton}>
        About
      </Link>
      <Link href="/equipment" className={styles.quickLinkButton}>
        Recommended Equipment
      </Link>
      <Link href="/book" className={`${styles.quickLinkButton} ${styles.quickLinkButtonOutline}`}>
        Book In Person
      </Link>
    </div>
  );
}
