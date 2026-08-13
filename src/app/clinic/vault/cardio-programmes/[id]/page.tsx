import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClinicBrandbar from "../../../ClinicBrandbar";
import VaultTabs from "../../VaultTabs";
import ReviewToggleButton from "./ReviewToggleButton";
import styles from "../../VaultLibrary.module.css";
import listStyles from "../CardioProgrammes.module.css";

export const dynamic = "force-dynamic";

type CardioProgramme = {
  id: string;
  name: string;
  goal: string | null;
  modality: string;
  total_weeks: number | null;
  suggested_phase: string | null;
  source_url: string | null;
  source_label: string | null;
  review_status: "pending" | "reviewed";
};

type CardioProgrammeDay = {
  week_number: number;
  day_number: number;
  description: string;
};

// Read-only detail: full day-by-day content where it's been loaded (see
// 0060_cardio_programmes.sql), or just the catalog fields plus a link out
// to Concept2's own page where it hasn't. The only interactive control is
// the review-status toggle (ReviewToggleButton) -- no editing here, per
// the Phase 3 scope (David reads and reviews, he doesn't rebuild this).
export default async function CardioProgrammeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [programmeRes, daysRes] = await Promise.all([
    supabaseAdmin
      .from("cardio_programmes")
      .select("id, name, goal, modality, total_weeks, suggested_phase, source_url, source_label, review_status")
      .eq("id", id)
      .maybeSingle<CardioProgramme>(),
    supabaseAdmin
      .from("cardio_programme_days")
      .select("week_number, day_number, description")
      .eq("cardio_programme_id", id)
      .order("sort_order")
      .returns<CardioProgrammeDay[]>(),
  ]);

  if (programmeRes.error) throw new Error(`Cardio programme query failed: ${programmeRes.error.message}`);
  if (daysRes.error) throw new Error(`Cardio programme days query failed: ${daysRes.error.message}`);
  if (!programmeRes.data) notFound();

  const programme = programmeRes.data;
  const days = daysRes.data ?? [];
  const weeks = Array.from(new Set(days.map((d) => d.week_number))).sort((a, b) => a - b);

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <ClinicBrandbar />

        <div className={styles.topbar}>
          <div>
            <h1>Vault</h1>
            <div className={styles.sub}>Build and manage your reusable exercises, blocks, sessions, and programmes</div>
          </div>
        </div>

        <VaultTabs active="blocks" />

        <div className={listStyles.header}>
          <Link href="/clinic/vault/cardio-programmes" className={styles.sub} style={{ textDecoration: "underline" }}>
            &larr; Back to cardio programmes
          </Link>
        </div>

        <div className={listStyles.detailSection}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h3>{programme.name}</h3>
            <ReviewToggleButton programmeId={programme.id} initialStatus={programme.review_status} />
          </div>
          {programme.goal && <p className={styles.sub}>{programme.goal}</p>}
          <p className={styles.sub}>
            {programme.total_weeks ? `${programme.total_weeks} weeks. ` : ""}
            {programme.suggested_phase && `Suggested phase: ${programme.suggested_phase}. `}
            {programme.source_label && `Source: ${programme.source_label}.`}
          </p>
          {programme.source_url && (
            <p className={styles.sub}>
              <a href={programme.source_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
                View the full plan on Concept2&apos;s site &rarr;
              </a>
            </p>
          )}
        </div>

        {weeks.length > 0 ? (
          <div className={listStyles.detailSection}>
            <h3>Day by day</h3>
            {weeks.map((weekNumber) => (
              <div key={weekNumber}>
                <div className={listStyles.weekHeading}>Week {weekNumber}</div>
                <div className={listStyles.dayList}>
                  {days
                    .filter((d) => d.week_number === weekNumber)
                    .map((d) => (
                      <div key={`${d.week_number}-${d.day_number}`} className={listStyles.dayRow}>
                        Day {d.day_number}: {d.description}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={listStyles.detailSection}>
            <p className={styles.sub}>
              Not yet loaded day by day here; catalogued by name and goal only for now. Use the link above for the
              full plan.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
