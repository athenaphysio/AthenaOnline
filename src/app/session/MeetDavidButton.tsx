import Link from "next/link";
import styles from "./TodaySession.module.css";
import { darkenHex } from "@/lib/colorShade";
import type { ResolvedBrandPack } from "@/lib/brandPackResolve";

// The last element on the landing page, closing out the headshot/tagline
// signature moment (SignatureFooter.tsx) right above it.
export default function MeetDavidButton({ brand }: { brand?: ResolvedBrandPack }) {
  const custom = brand && !brand.isAllDefault ? brand.accent_color : null;
  return (
    <div className={styles.quickLinks}>
      <Link
        href="/about"
        className={`${styles.quickLinkButton} ${styles.quickLinkAbout}`}
        style={custom ? { background: `linear-gradient(135deg, ${darkenHex(custom, 0.45)}, ${darkenHex(custom, 0.25)})` } : undefined}
      >
        Meet David &amp; Friends
      </Link>
    </div>
  );
}
