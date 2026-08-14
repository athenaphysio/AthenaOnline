import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { SHOP_SECTIONS, EXPLORE_TILE_SLUGS } from "@/lib/shopSections";
import sessionStyles from "./TodaySession.module.css";
import shopStyles from "../shop/shop.module.css";

type TileStyle = CSSProperties & {
  "--section-accent"?: string;
  "--section-accent-soft"?: string;
  "--section-on-accent"?: string;
};

// The shop, presented as a set of branded worlds rather than a flat list of
// programmes. Its own "Recommended equipment" link moved out to sit as a
// button under Memberships (QuickLinks.tsx), rather than tucked inside
// here. Free Resources, Atomic Sports, Athena Wellbeing and Athena
// Concussion only -- Rugby/Pool/Mobility Resources moved under Free
// Resources instead of sitting here as their own (empty) tiles.
export default function ExploreSection() {
  const tiles = EXPLORE_TILE_SLUGS.map((slug) => SHOP_SECTIONS.find((s) => s.slug === slug)).filter((s) => s != null);

  return (
    <div>
      <div className={sessionStyles.sectionHeading}>Explore</div>
      <div className={shopStyles.tileGrid}>
        {tiles.map((section) => {
          const style: TileStyle = {
            "--section-accent": section.accent,
            "--section-accent-soft": section.accentSoft,
            "--section-on-accent": section.onAccent,
          };
          return (
            <Link key={section.slug} href={section.href ?? `/shop/${section.slug}`} className={shopStyles.tile} style={style}>
              <Image
                src={section.image}
                alt=""
                fill
                sizes="(min-width: 420px) 50vw, 100vw"
                className={shopStyles.tileImage}
              />
              <div className={shopStyles.tileInfoBox}>
                {!section.hasBakedInTitle && <div className={shopStyles.tileInfoBoxTitle}>{section.name}</div>}
                <div className={shopStyles.tileInfoBoxStrap}>{section.tagline}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
