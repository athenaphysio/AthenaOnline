import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { SHOP_SECTIONS } from "@/lib/shopSections";
import sessionStyles from "./TodaySession.module.css";
import shopStyles from "../shop/shop.module.css";

type TileStyle = CSSProperties & {
  "--section-accent"?: string;
  "--section-accent-soft"?: string;
  "--section-on-accent"?: string;
};

// The shop, presented as a set of branded worlds rather than a flat list of
// programmes. Always the last thing on the landing page, after the
// client's own session -- see ContinueSection.
export default function ExploreSection() {
  return (
    <div>
      <div className={sessionStyles.sectionHeading}>Explore</div>
      <div className={shopStyles.tileGrid}>
        {SHOP_SECTIONS.map((section) => {
          const style: TileStyle = {
            "--section-accent": section.accent,
            "--section-accent-soft": section.accentSoft,
            "--section-on-accent": section.onAccent,
          };
          return (
            <Link key={section.slug} href={`/shop/${section.slug}`} className={shopStyles.tile} style={style}>
              <Image
                src={section.image}
                alt=""
                fill
                sizes="(min-width: 420px) 50vw, 100vw"
                className={shopStyles.tileImage}
              />
              <div className={shopStyles.tileOverlay} />
              <div className={shopStyles.tileContent}>
                <div className={shopStyles.tileName}>{section.name}</div>
                <div className={shopStyles.tileTagline}>{section.tagline}</div>
              </div>
            </Link>
          );
        })}
      </div>
      <Link href="/equipment" className={shopStyles.equipmentLink}>
        Recommended equipment →
      </Link>
    </div>
  );
}
