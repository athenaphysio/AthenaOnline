import type { CSSProperties } from "react";
import { redirect, notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getShopSection } from "@/lib/shopSections";
import { getShopProgramme } from "@/lib/shopProgrammes";
import { formatPriceGBP } from "@/lib/currency";
import { getVimeoInfo } from "@/lib/vimeo";
import BuyButton from "../../BuyButton";
import ClaimButton from "../../ClaimButton";
import ComingSoonCover from "../../ComingSoonCover";
import sessionStyles from "../../../session/TodaySession.module.css";
import shopStyles from "../../shop.module.css";

type HeaderStyle = CSSProperties & {
  "--section-accent"?: string;
  "--section-accent-soft"?: string;
  "--section-on-accent"?: string;
};

type ExerciseRow = {
  exercise_id: string;
  name_clinical: string;
  name_patient_facing: string | null;
  vimeo_url: string | null;
};

type TemplateAccessRow = { access: "paid" | "free"; price_gbp: number | null; cover_image_url: string | null };

export default async function ShopProgrammePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; programmeSlug: string }>;
  searchParams: Promise<{ purchase?: string }>;
}) {
  const { slug, programmeSlug } = await params;
  const { purchase } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/start");
  }

  const section = getShopSection(slug);
  const programme = getShopProgramme(slug, programmeSlug);
  if (!section || !programme) {
    notFound();
  }

  const comingSoon = programme.comingSoon === true;

  // Shared clinical content, same trust boundary used everywhere else in
  // the app -- fetched via supabaseAdmin, not because it's secret (the
  // exercise library is publicly readable), but to stay consistent with
  // how every other page reads it. Skipped entirely for a coming-soon
  // listing, which has no sample exercise to show.
  const exercise =
    !comingSoon && programme.sampleExerciseId
      ? (
          await supabaseAdmin
            .from("exercises")
            .select("exercise_id, name_clinical, name_patient_facing, vimeo_url")
            .eq("exercise_id", programme.sampleExerciseId)
            .maybeSingle<ExerciseRow>()
        ).data
      : null;
  const video = exercise ? await getVimeoInfo(exercise.vimeo_url) : null;
  const exerciseName = exercise ? exercise.name_patient_facing || exercise.name_clinical : null;

  // Price, access, and cover image live on the real Programme Template once
  // one's linked -- the config's priceGBP/coverImage are only a fallback for
  // a listing that isn't linked to a template yet.
  let access: "paid" | "free" = "paid";
  let priceGBP = programme.priceGBP;
  let coverUrl = programme.coverImage ?? null;
  if (programme.templateId) {
    const { data: template } = await supabaseAdmin
      .from("programme_templates")
      .select("access, price_gbp, cover_image_url")
      .eq("id", programme.templateId)
      .maybeSingle<TemplateAccessRow>();
    if (template) {
      access = template.access;
      priceGBP = template.price_gbp ?? programme.priceGBP;
      coverUrl = template.cover_image_url ?? coverUrl;
    }
  }

  const headerStyle: HeaderStyle = {
    "--section-accent": section.accent,
    "--section-accent-soft": section.accentSoft,
    "--section-on-accent": section.onAccent,
  };
  const priceLabel = priceGBP != null ? formatPriceGBP(priceGBP) : null;
  const totalSessions =
    programme.weeks != null && programme.sessionsPerWeek != null ? programme.weeks * programme.sessionsPerWeek : null;

  return (
    <div className={sessionStyles.app}>
      <div className={sessionStyles.inner} style={headerStyle}>
        <div className={shopStyles.sectionHeader}>
          {coverUrl ? (
            <Image src={coverUrl} alt="" fill sizes="480px" className={shopStyles.sectionImage} />
          ) : (
            <ComingSoonCover />
          )}
          <div className={shopStyles.sectionOverlay} />
          <div className={shopStyles.sectionHeaderContent}>
            <Link href={`/shop/${slug}`} className={shopStyles.sectionBack}>
              ← {section.name}
            </Link>
            <div className={shopStyles.sectionName}>{programme.title}</div>
            <div className={shopStyles.sectionTagline}>{programme.summary}</div>
          </div>
        </div>

        <div className={shopStyles.sectionBody}>
          {purchase === "success" && (
            <div
              style={{
                background: "var(--crimson-light)",
                border: "1px solid var(--crimson)",
                borderRadius: 14,
                padding: "14px 18px",
                marginBottom: 16,
                color: "var(--crimson-dark)",
                fontSize: 14,
              }}
            >
              Payment received, thank you. Your purchase of {programme.title} is recorded.
            </div>
          )}
          {purchase === "cancelled" && (
            <div
              style={{
                background: "var(--sand)",
                borderRadius: 14,
                padding: "14px 18px",
                marginBottom: 16,
                color: "var(--stone)",
                fontSize: 14,
              }}
            >
              Checkout was cancelled, nothing was charged.
            </div>
          )}

          {comingSoon ? (
            <p className={shopStyles.comingSoonNotice}>
              This programme is still being built. Check back soon, there is nothing to buy here yet.
            </p>
          ) : (
            <>
              <div className={shopStyles.priceRow}>
                {access === "paid" && priceLabel && <div className={shopStyles.priceTag}>{priceLabel}</div>}
                {access === "free" ? (
                  <ClaimButton sectionSlug={slug} programmeSlug={programmeSlug} />
                ) : (
                  <BuyButton sectionSlug={slug} programmeSlug={programmeSlug} priceLabel={priceLabel ?? ""} />
                )}
              </div>

              {programme.description && (
                <div className={shopStyles.detailSection}>
                  <p className={shopStyles.detailBody}>{programme.description}</p>
                </div>
              )}

              {programme.weeks != null && totalSessions != null && programme.exerciseCount != null && (
                <div className={shopStyles.detailSection}>
                  <div className={shopStyles.detailHeading}>What&apos;s included</div>
                  <div className={shopStyles.statRow}>
                    <div className={shopStyles.statChip}>
                      <b>{programme.weeks}</b> weeks
                    </div>
                    <div className={shopStyles.statChip}>
                      <b>{totalSessions}</b> sessions
                    </div>
                    <div className={shopStyles.statChip}>
                      <b>{programme.exerciseCount}</b> exercises
                    </div>
                  </div>
                </div>
              )}

              {programme.weeklyStructure && programme.weeklyStructure.length > 0 && (
                <div className={shopStyles.detailSection}>
                  <div className={shopStyles.detailHeading}>A typical week</div>
                  <div className={shopStyles.structureList}>
                    {programme.weeklyStructure.map((row, i) => (
                      <div key={i} className={shopStyles.structureRow}>
                        {row}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {exercise && (
                <div className={shopStyles.detailSection}>
                  <div className={shopStyles.detailHeading}>See it in action</div>
                  <div className={sessionStyles.card}>
                    {video ? (
                      <div className={sessionStyles.videoEmbed} style={{ aspectRatio: video.aspectRatio }}>
                        <div className={sessionStyles.vtag}>Sample exercise</div>
                        <iframe
                          src={video.embedUrl}
                          title={exerciseName ?? "Sample exercise"}
                          allow="fullscreen; picture-in-picture"
                          allowFullScreen
                          className={sessionStyles.videoFrame}
                        />
                      </div>
                    ) : (
                      <div className={sessionStyles.video}>
                        <div className={sessionStyles.vtag}>Sample exercise</div>
                        <div className={sessionStyles.play} />
                      </div>
                    )}
                    <div className={sessionStyles.body}>
                      <div className={sessionStyles.xname}>{exerciseName}</div>
                    </div>
                  </div>
                </div>
              )}

              {programme.notIncluded && programme.notIncluded.length > 0 && (
                <div className={shopStyles.detailSection}>
                  <div className={shopStyles.detailHeading}>What this does not include</div>
                  <div className={shopStyles.notIncludedList}>
                    {programme.notIncluded.map((row, i) => (
                      <div key={i} className={shopStyles.notIncludedRow}>
                        {row}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={shopStyles.detailSection} style={{ marginBottom: 20 }}>
                {access === "free" ? (
                  <ClaimButton sectionSlug={slug} programmeSlug={programmeSlug} />
                ) : (
                  <BuyButton sectionSlug={slug} programmeSlug={programmeSlug} priceLabel={priceLabel ?? ""} />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
