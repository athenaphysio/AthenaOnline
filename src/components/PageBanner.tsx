import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./PageBanner.module.css";
import { darkenHex } from "@/lib/colorShade";
import type { ResolvedBrandPack } from "@/lib/brandPackResolve";

type Props = {
  label?: string;
  /** Wraps the logo and label in a link, e.g. back to the dashboard. */
  href?: string;
  /** Right-aligned slot, e.g. a "back" link. */
  actions?: ReactNode;
  /** Omitted on pages with no patient to resolve a pack for (public
   * pages like /start, /register) -- those keep today's fixed Athena
   * look exactly, same as when this resolves to all-default anyway. */
  brand?: ResolvedBrandPack;
  /** The page sits on a dark pack's deep canvas (the login pages), so the
   * banner takes the dark header to match. */
  onDarkCanvas?: boolean;
};

// The crimson, mountain-textured banner from the main dashboard
// (SiteBanner.tsx), scaled down for secondary pages that carry the same
// wordmark but not the notification bell or site menu.
export default function PageBanner({ label = "Athena Physio", href, actions, brand, onDarkCanvas = false }: Props) {
  const isDark = Boolean(onDarkCanvas && brand && !brand.isAllDefault && brand.theme === "dark");
  // A dark pack prefers its reversed (light) wordmark and a header tinted
  // from its own canvas, matching the home screen (see SiteBanner.tsx).
  const wordmarkSrc = brand && !brand.isAllDefault ? (isDark && brand.wordmark_reversed_url) || brand.wordmark_url : null;
  const showWordmark = Boolean(wordmarkSrc);
  const showCustomGradient = brand && !brand.isAllDefault && !isDark;

  const brandBlock = showWordmark ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={wordmarkSrc!} alt="" className={styles.wordmark} />
  ) : (
    <>
      <div className={styles.logo} style={brand ? { borderColor: brand.accent_color } : undefined}>
        {brand?.logo_mark_url && !brand.isAllDefault ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logo_mark_url} alt="" width={18} height={18} style={{ objectFit: "contain" }} />
        ) : (
          <Image src="/icons/athena-mark.png" alt="" width={18} height={18} />
        )}
      </div>
      <div className={styles.label}>{label}</div>
    </>
  );

  return (
    <div
      className={isDark ? `${styles.banner} ${styles.bannerDark}` : styles.banner}
      style={
        showCustomGradient
          ? { background: `linear-gradient(135deg, ${brand.accent_color} 0%, ${darkenHex(brand.accent_color, 0.12)} 100%)` }
          : undefined
      }
    >
      {href ? (
        <Link href={href} className={styles.brand}>
          {brandBlock}
        </Link>
      ) : (
        <div className={styles.brand}>{brandBlock}</div>
      )}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
