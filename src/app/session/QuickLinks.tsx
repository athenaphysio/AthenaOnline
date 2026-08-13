import Link from "next/link";
import styles from "./TodaySession.module.css";

// Three full-width secondary actions, sat directly under the client's own
// active-programme area on the landing page (never above it) and above
// Free Resources. Each gets its own crimson-family tone -- distinct from
// each other, but all clearly one branded family -- rather than singling
// one out as visually different. "Meet David & Friends" used to live here
// too -- moved to sit right after the headshot/tagline signature block
// instead, which is now the last thing on the page. Recommended equipment
// used to be its own plain text link further down (RecommendedEquipmentSection.tsx,
// now removed) -- brought up here as a button to match, directly under
// Memberships.
export default function QuickLinks() {
  return (
    <div className={styles.quickLinks}>
      <Link href="/membership" className={`${styles.quickLinkButton} ${styles.quickLinkMemberships}`}>
        Memberships
      </Link>
      <Link href="/equipment" className={`${styles.quickLinkButton} ${styles.quickLinkEquipment}`}>
        Recommended equipment
      </Link>
      <Link href="/book" className={`${styles.quickLinkButton} ${styles.quickLinkBook}`}>
        Booking
      </Link>
    </div>
  );
}
