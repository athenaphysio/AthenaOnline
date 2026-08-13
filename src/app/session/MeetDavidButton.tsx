import Link from "next/link";
import styles from "./TodaySession.module.css";

// The last element of the headshot/tagline signature moment right under
// the landing page's hero content -- moved out of QuickLinks, which used
// to carry it further down the page.
export default function MeetDavidButton() {
  return (
    <div className={styles.quickLinks}>
      <Link href="/about" className={`${styles.quickLinkButton} ${styles.quickLinkAbout}`}>
        Meet David &amp; Friends
      </Link>
    </div>
  );
}
