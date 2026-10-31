import Image from "next/image";
import type { CSSProperties } from "react";
import { cookies } from "next/headers";
import { LOADING_BRAND_COOKIE, decodeLoadingBrand } from "@/lib/loadingBrand";
import styles from "./Loading.module.css";

// The holding page shown while the landing page gathers the client's
// programme. It opens in the style the client last saw (the landing page
// leaves a cookie, see LoadingBrandCookie.tsx): the dark executive canvas
// for a dark brand pack such as Ergon Executive, otherwise the familiar
// cream Athena page. Nothing here waits on the database.
export default async function Loading() {
  const brand = decodeLoadingBrand((await cookies()).get(LOADING_BRAND_COOKIE)?.value);

  if (brand.theme === "dark") {
    const base = brand.canvas ?? "#250a0b";
    const accent = brand.accent ?? "#9b1c1c";
    const glow = (alpha: number) => `color-mix(in srgb, ${accent} ${Math.round(alpha * 100)}%, transparent)`;
    const strength = brand.bar ? 0.55 : 1;
    const layers = [
      `radial-gradient(110% 55% at 50% 30%, ${glow(0.4 * strength)} 0%, transparent 62%)`,
      `radial-gradient(80% 45% at 105% 0%, ${glow(0.22)} 0%, transparent 70%)`,
      `radial-gradient(70% 40% at -10% 95%, ${glow(0.2)} 0%, transparent 70%)`,
      `linear-gradient(180deg, color-mix(in srgb, ${base} 94%, white) 0%, ${base} 100%)`,
    ];
    const style: CSSProperties = {
      ...(brand.bar ? ({ "--loading-bar": brand.bar, "--loading-label": "#c3cfde" } as CSSProperties) : {}),
      backgroundColor: base,
      backgroundImage: layers.join(", "),
      backgroundSize: "100% 100%",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    };

    return (
      <div className={`${styles.holding} ${styles.holdingDark}`} style={style} role="status" aria-live="polite">
        {brand.textureUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.textureUrl} alt="" aria-hidden="true" className={styles.ridge} />
        )}
        <div className={styles.centre}>
          {brand.wordmarkUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.wordmarkUrl} alt="" className={`${styles.wordmark} ${styles.breath}`} />
          ) : (
            <Image src="/icons/athena-mark.png" alt="" width={72} height={72} className={styles.breath} />
          )}
          <div className={styles.progress}>
            <div className={styles.track}>
              <div className={styles.bar} />
            </div>
            <div className={styles.label}>Preparing your programme</div>
          </div>
        </div>
        {(brand.footer ?? "Dr David Silver PhD") && <div className={styles.footer}>{brand.footer ?? "Dr David Silver PhD"}</div>}
      </div>
    );
  }

  return (
    <div className={styles.holding} role="status" aria-live="polite">
      <div className={styles.centre}>
        <Image src="/icons/athena-mark.png" alt="" width={72} height={72} className={styles.breath} />
        <div className={styles.lightTitle}>Athena Online</div>
        <div className={styles.progress}>
          <div className={styles.track}>
            <div className={styles.bar} />
          </div>
          <div className={styles.label}>Preparing your programme</div>
        </div>
      </div>
      <div className={styles.footer}>Dr David Silver PhD</div>
    </div>
  );
}
