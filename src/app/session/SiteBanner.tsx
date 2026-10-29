import Image from "next/image";
import NotificationBell from "./NotificationBell";
import SiteMenu from "./SiteMenu";
import styles from "./TodaySession.module.css";
import { darkenHex } from "@/lib/colorShade";
import type { ResolvedBrandPack } from "@/lib/brandPackResolve";

// Full-bleed banner at the very top of the landing page, above the
// max-width .inner column -- replaces the old plain brandbar row here.
// A solid crimson block (with a subtle diagonal shade for texture, not a
// fade to another colour) closed off with a thin white line, rather than
// dissolving into the page below.
//
// `brand` is optional so every other caller of this component (there
// were none before Feature 2, but keeping it optional costs nothing)
// keeps today's exact fixed Athena look with zero props. When the
// resolved pack is entirely the default anyway (the common case --
// isAllDefault), the CSS file's own hardcoded gradient renders unchanged
// rather than reconstructing it from accent_color and risking a pixel-
// perfect mismatch with today's hand-tuned three-stop version.
export default function SiteBanner({ brand }: { brand?: ResolvedBrandPack }) {
  const isDark = Boolean(brand && !brand.isAllDefault && brand.theme === "dark");
  // A dark pack prefers its reversed (light) wordmark, since the ordinary
  // one is drawn for light backgrounds such as emails and PDFs.
  const wordmarkSrc = brand && !brand.isAllDefault ? (isDark && brand.wordmark_reversed_url) || brand.wordmark_url : null;
  const showWordmark = Boolean(wordmarkSrc);
  const showCustomGradient = brand && !brand.isAllDefault && !isDark;

  return (
    <div
      className={isDark ? `${styles.siteBanner} ${styles.siteBannerDark}` : styles.siteBanner}
      style={
        showCustomGradient
          ? { background: `linear-gradient(135deg, ${brand.accent_color} 0%, ${darkenHex(brand.accent_color, 0.12)} 100%)` }
          : undefined
      }
    >
      {showWordmark ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={wordmarkSrc!} alt="" className={styles.siteBannerWordmark} />
      ) : (
        <>
          <div className={styles.siteBannerLogo} style={brand ? { borderColor: brand.accent_color } : undefined}>
            {brand?.logo_mark_url && !brand.isAllDefault ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logo_mark_url} alt="" width={24} height={24} style={{ objectFit: "contain" }} />
            ) : (
              <Image src="/icons/athena-mark.png" alt="" width={24} height={24} />
            )}
          </div>
          <div className={styles.siteBannerText}>
            <div className={styles.siteBannerTitle}>Athena Online</div>
            <div className={styles.siteBannerSubtitle}>by Dr David Silver PhD</div>
          </div>
        </>
      )}
      <div className={styles.siteBannerActions} style={{ marginLeft: showWordmark ? "auto" : undefined }}>
        <NotificationBell variant="banner" />
        <SiteMenu show={brand?.app_layout.home} />
      </div>
    </div>
  );
}
