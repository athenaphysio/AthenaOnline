import type { CSSProperties } from "react";
import { redirect, notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getShopSection } from "@/lib/shopSections";
import { getShopProgrammesForSection } from "@/lib/shopProgrammes";
import { formatPriceGBP } from "@/lib/currency";
import ComingSoonCover from "../ComingSoonCover";
import sessionStyles from "../../session/TodaySession.module.css";
import shopStyles from "../shop.module.css";

type HeaderStyle = CSSProperties & {
  "--section-accent"?: string;
  "--section-accent-soft"?: string;
  "--section-on-accent"?: string;
};

type TemplateAccessRow = {
  id: string;
  access: "paid" | "free";
  price_gbp: number | null;
  cover_image_url: string | null;
};

export default async function ShopSectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/start");
  }

  const section = getShopSection(slug);
  if (!section) {
    notFound();
  }

  const headerStyle: HeaderStyle = {
    "--section-accent": section.accent,
    "--section-accent-soft": section.accentSoft,
    "--section-on-accent": section.onAccent,
  };

  const programmes = getShopProgrammesForSection(slug);

  // Price and access come from the real Programme Template once one's
  // linked (same precedence as the detail page) -- batched into one query
  // rather than one per card.
  const templateIds = programmes.map((p) => p.templateId).filter((id): id is string => !!id);
  const templateMap = new Map<
    string,
    { access: "paid" | "free"; price_gbp: number | null; cover_image_url: string | null }
  >();
  if (templateIds.length > 0) {
    const { data: templates } = await supabaseAdmin
      .from("programme_templates")
      .select("id, access, price_gbp, cover_image_url")
      .in("id", templateIds)
      .returns<TemplateAccessRow[]>();
    for (const t of templates ?? []) {
      templateMap.set(t.id, { access: t.access, price_gbp: t.price_gbp, cover_image_url: t.cover_image_url });
    }
  }

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
          {programmes.length === 0 ? (
            <p className={shopStyles.sectionEmpty}>Nothing in this section yet. Check back soon.</p>
          ) : (
            <div className={shopStyles.programmeList}>
              {programmes.map((programme) => {
                const template = programme.templateId ? templateMap.get(programme.templateId) : undefined;
                const access = template?.access ?? "paid";
                const priceGBP = template?.price_gbp ?? programme.priceGBP;
                const coverUrl = template?.cover_image_url ?? programme.coverImage ?? null;
                return (
                  <Link
                    key={programme.slug}
                    href={`/shop/${slug}/${programme.slug}`}
                    className={shopStyles.programmeCard}
                  >
                    <div className={shopStyles.programmeCover}>
                      {coverUrl ? (
                        <Image src={coverUrl} alt="" fill sizes="480px" className={shopStyles.programmeCoverImage} />
                      ) : (
                        <ComingSoonCover />
                      )}
                    </div>
                    <div className={shopStyles.programmeCardBody}>
                      <div className={shopStyles.programmeCardTitle}>{programme.title}</div>
                      <p className={shopStyles.programmeCardSummary}>{programme.summary}</p>
                      {programme.comingSoon ? (
                        <div className={shopStyles.programmeCardComingSoon}>Coming soon</div>
                      ) : access === "free" ? (
                        <div className={shopStyles.programmeCardFreeTag}>Free</div>
                      ) : (
                        <div className={shopStyles.programmeCardPrice}>{formatPriceGBP(priceGBP ?? 0)}</div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
