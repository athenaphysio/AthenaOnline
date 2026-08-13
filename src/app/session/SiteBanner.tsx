import Image from "next/image";
import NotificationBell from "./NotificationBell";
import styles from "./TodaySession.module.css";

// Full-bleed banner at the very top of the landing page, above the
// max-width .inner column -- replaces the old plain brandbar row here.
// Crimson at the top fading to cream at the bottom; the subtitle line
// sits in the lighter part of the gradient, so it's set in a dark
// crimson rather than cream to stay legible there (see the scrim layer
// in .siteBanner itself for the same reason).
export default function SiteBanner() {
  return (
    <div className={styles.siteBanner}>
      <div className={styles.siteBannerLogo}>
        <Image src="/icons/athena-mark.png" alt="" width={24} height={24} />
      </div>
      <div className={styles.siteBannerText}>
        <div className={styles.siteBannerTitle}>Athena Online</div>
        <div className={styles.siteBannerSubtitle}>by Dr David Silver PhD</div>
      </div>
      <div className={styles.siteBannerBell}>
        <NotificationBell variant="banner" />
      </div>
    </div>
  );
}
