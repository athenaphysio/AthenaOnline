import Link from "next/link";
import styles from "./TodaySession.module.css";

// The last element on the landing page, closing out the headshot/tagline
// signature moment (SignatureFooter.tsx) right above it.
export default function MeetDavidButton() {
  return (
    <div className={styles.quickLinks}>
      <Link href="/about" className={`${styles.quickLinkButton} ${styles.quickLinkAbout}`}>
        Meet David &amp; Friends
      </Link>
    </div>
  );
}
