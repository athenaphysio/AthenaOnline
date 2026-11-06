import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClinicBrandbar from "../../ClinicBrandbar";
import VaultTabs from "../VaultTabs";
import styles from "../VaultLibrary.module.css";
import listStyles from "./CardioProgrammes.module.css";
import CardioProgrammesList, { type CardioProgrammeRow } from "./CardioProgrammesList";

export const dynamic = "force-dynamic";


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

        <VaultTabs active="cardio-programmes" />

        <div className={listStyles.header}>
          <h3>Cardio programmes</h3>
          <div className={styles.sub}>
            Multi-week cardio plans (Concept2&apos;s own programmes) -- separate from the Programmes tab above, since
            these vary week to week rather than repeating a fixed weekly schedule. Read-only for now; no builder here.
          </div>
        </div>

        <CardioProgrammesList programmes={programmes} />
      </div>
    </div>
  );
}
