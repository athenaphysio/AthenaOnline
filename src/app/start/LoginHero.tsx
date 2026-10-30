import type { ResolvedBrandPack } from "@/lib/brandPackResolve";
import styles from "./start.module.css";

// The top of a branded login or set password page: the brand's own logo
// front and centre, a short accent line, and beneath it the pack's own app
// logo when it has one (for example ROAM under Regenerate), with its
// strapline directly beneath.
export default function LoginHero({ brand }: { brand: ResolvedBrandPack }) {
  const isDark = brand.theme === "dark";
  const wordmark = (isDark && brand.wordmark_reversed_url) || brand.wordmark_url || brand.logo_mark_url;
  const appLogo = brand.app_layout.app_logo;
  return (
    <div className={styles.hero}>
      {wordmark && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={wordmark} alt={brand.name} className={styles.heroWordmark} />
      )}
      <div className={styles.heroRule} aria-hidden="true" />
      {appLogo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={appLogo} alt={brand.app_layout.app_name || ""} className={styles.heroAppLogo} />
      )}
      {appLogo && brand.app_layout.app_strapline && <p className={styles.heroStrapline}>{brand.app_layout.app_strapline}</p>}
    </div>
  );
}
