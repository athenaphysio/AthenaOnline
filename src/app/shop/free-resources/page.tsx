import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SHOP_SECTIONS, FREE_RESOURCE_SLUGS, getShopSection } from "@/lib/shopSections";
import sessionStyles from "../../session/TodaySession.module.css";
import shopStyles from "../shop.module.css";

type HeaderStyle = CSSProperties & {
  "--section-accent"?: string;
  "--section-accent-soft"?: string;
  "--section-on-accent"?: string;
};

type TileStyle = CSSProperties & {
  "--section-accent"?: string;
  "--section-accent-soft"?: string;
  "--section-on-accent"?: string;
};

// The Free Resources hub -- a static route (not the generic /shop/[slug]
// product-listing template, since this has nothing to sell), reached from
// its own Explore tile. Rugby/Pool/Mobility Resources live here as cards
// rather than as their own top-level Explore tiles -- same section pages
// (/shop/[slug]) as before, just discovered from here instead. Square-card
// grid per athena_explore_cards_mockup.html, distinct from the main
// Explore grid's own layout.
export default async function FreeResourcesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/start");
  }

  const section = getShopSection("free-resources");
  if (!section) return null;

  const headerStyle: HeaderStyle = {
    "--section-accent": section.accent,
    "--section-accent-soft": section.accentSoft,
    "--section-on-accent": section.onAccent,
  };

  const cards = FREE_RESOURCE_SLUGS.map((slug) => SHOP_SECTIONS.find((s) => s.slug === slug)).filter((s) => s != null);

  return (
    <div className={sessionStyles.app}>
      <div className={sessionStyles.inner}>
        <div className={shopStyles.sectionHeader} style={headerStyle}>
          <Image src={section.image} alt="" fill sizes="480px" className={shopStyles.sectionImage} />
          <div className={shopStyles.sectionOverlay} />
          <div className={shopStyles.sectionHeaderContent}>
            <Link href="/session" className={shopStyles.sectionBack}>
              ← Back
            </Link>
            <div className={shopStyles.sectionName}>{section.name}</div>
            <div className={shopStyles.sectionTagline}>{section.tagline}</div>
          </div>
        </div>

        <div className={shopStyles.sectionBody}>
          <div className={shopStyles.resourceGrid}>
            {cards.map((card) => {
              const style: TileStyle = {
                "--section-accent": card.accent,
                "--section-accent-soft": card.accentSoft,
                "--section-on-accent": card.onAccent,
              };
              return (
                <Link key={card.slug} href={`/shop/${card.slug}`} className={shopStyles.resourceCard} style={style}>
                  <Image src={card.image} alt="" fill sizes="(min-width: 420px) 33vw, 50vw" className={shopStyles.tileImage} />
                  <div className={shopStyles.tileInfoBox}>
                    {!card.hasBakedInTitle && <div className={shopStyles.tileInfoBoxTitle}>{card.name}</div>}
                    <div className={shopStyles.tileInfoBoxStrap}>{card.tagline}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
