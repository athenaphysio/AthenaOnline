import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClinicBrandbar from "../../ClinicBrandbar";
import VaultTabs from "../VaultTabs";
import styles from "../VaultLibrary.module.css";
import listStyles from "./CardioProgrammes.module.css";

export const dynamic = "force-dynamic";

type CardioProgrammeRow = {
  id: string;
  name: string;
  goal: string | null;
  suggested_phase: string | null;
  total_weeks: number | null;
  review_status: "pending" | "reviewed";
};

// A plain read-only list, not a builder -- see 0062_cardio_review_status.sql
// and the Phase 3 audit note there for why this content (Concept2's own
// multi-week plans) got its own minimal view rather than being folded into
// the Programmes tab: a programme_template's weekly schedule repeats every
// week, this genuinely varies week to week, so it isn't the same shape of
// thing. David reviews this by reading it here, not rebuilding it.
export default async function CardioProgrammesPage() {
  const { data, error } = await supabaseAdmin
    .from("cardio_programmes")
    .select("id, name, goal, suggested_phase, total_weeks, review_status")
    .order("name")
    .returns<CardioProgrammeRow[]>();

  if (error) {
    throw new Error(`Cardio programmes query failed: ${error.message}`);
  }

  const programmes = data ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <ClinicBrandbar />

        <div className={styles.topbar}>
          <div>
            <h1>Vault</h1>
            <div className={styles.sub}>Build and manage your reusable exercises, blocks, workouts, and programmes</div>
          </div>
        </div>

        <VaultTabs active="blocks" />

        <div className={listStyles.header}>
          <h3>Cardio programmes</h3>
          <div className={styles.sub}>
            Multi-week cardio plans (Concept2&apos;s own programmes) -- separate from the Programmes tab above, since
            these vary week to week rather than repeating a fixed weekly schedule. Read-only for now; no builder here.
          </div>
        </div>

        <div className={listStyles.list}>
          {programmes.map((p) => (
            <Link key={p.id} href={`/clinic/vault/cardio-programmes/${p.id}`} className={listStyles.row}>
              <div className={listStyles.rowMain}>
                <div className={listStyles.rowName}>{p.name}</div>
                {p.goal && <div className={listStyles.rowGoal}>{p.goal}</div>}
              </div>
              <div className={listStyles.rowMeta}>
                {p.suggested_phase && <span className={listStyles.phaseTag}>{p.suggested_phase}</span>}
                {p.total_weeks && <span className={listStyles.weeksTag}>{p.total_weeks} weeks</span>}
                <span className={p.review_status === "pending" ? listStyles.pendingTag : listStyles.reviewedTag}>
                  {p.review_status === "pending" ? "Pending review" : "Reviewed"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
