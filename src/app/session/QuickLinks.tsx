import Link from "next/link";
import styles from "./TodaySession.module.css";
import { darkenHex } from "@/lib/colorShade";
import type { ResolvedBrandPack } from "@/lib/brandPackResolve";

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
//
// These three gradients are literal hex, not driven by the --crimson
// variable, so a custom pack's accent_color can't reach them by CSS
// scoping alone -- built here instead from the same accent at three
// darken amounts, keeping the "one family, three tones" look intact
// rather than flattening them to one identical colour.
export default function QuickLinks({ brand }: { brand?: ResolvedBrandPack }) {
  const custom = brand && !brand.isAllDefault ? brand.accent_color : null;
  const gradient = (amountA: number, amountB: number) =>
    custom ? { background: `linear-gradient(135deg, ${darkenHex(custom, amountA)}, ${darkenHex(custom, amountB)})` } : undefined;

  return (
    <div className={styles.quickLinks}>
      <Link href="/membership" className={`${styles.quickLinkButton} ${styles.quickLinkMemberships}`} style={gradient(0.25, 0)}>
        Memberships
      </Link>
      <Link href="/equipment" className={`${styles.quickLinkButton} ${styles.quickLinkEquipment}`} style={gradient(0.35, 0.1)}>
        Recommended equipment
      </Link>
      <Link href="/book" className={`${styles.quickLinkButton} ${styles.quickLinkBook}`} style={gradient(0.15, -0.1)}>
        Booking
      </Link>
    </div>
  );
}
