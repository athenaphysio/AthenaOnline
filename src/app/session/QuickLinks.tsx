import Link from "next/link";
import styles from "./TodaySession.module.css";

// Two full-width secondary actions, sat directly under the client's own
// active-programme area on the landing page (never above it) and above
// Explore. Each gets its own crimson-family tone -- distinct from each
// other, but all clearly one branded family -- rather than singling one
// out as visually different. "Meet David & Friends" used to live here too
// -- moved to sit right after the headshot/tagline signature block instead,
// as the last element of that hero moment.
export default function QuickLinks() {
  return (
    <div className={styles.quickLinks}>
      <Link href="/membership" className={`${styles.quickLinkButton} ${styles.quickLinkMemberships}`}>
        Memberships
      </Link>
      <Link href="/book" className={`${styles.quickLinkButton} ${styles.quickLinkBook}`}>
        Book in person
      </Link>
    </div>
  );
}
