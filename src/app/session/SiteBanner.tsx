import Image from "next/image";
import NotificationBell from "./NotificationBell";
import SiteMenu from "./SiteMenu";
import styles from "./TodaySession.module.css";

// Full-bleed banner at the very top of the landing page, above the
// max-width .inner column -- replaces the old plain brandbar row here.
// A solid crimson block (with a subtle diagonal shade for texture, not a
// fade to another colour) closed off with a thin white line, rather than
// dissolving into the page below.
export default function SiteBanner() {
  return (
    <div className={styles.siteBanner}>
      <div className={styles.siteBannerLogo}>
        {/* The mark's own artwork isn't optically centred in its square
            canvas -- nudged slightly left and down so it reads as centred
            inside the circle rather than merely centred by its own bounds. */}
        <Image
          src="/icons/athena-mark.png"
          alt=""
          width={24}
          height={24}
          style={{ transform: "translate(-4.6%, 6.6%)" }}
        />
      </div>
      <div className={styles.siteBannerText}>
        <div className={styles.siteBannerTitle}>Athena Online</div>
        <div className={styles.siteBannerSubtitle}>by Dr David Silver PhD</div>
      </div>
      <div className={styles.siteBannerActions}>
        <NotificationBell variant="banner" />
        <SiteMenu />
      </div>
    </div>
  );
}
