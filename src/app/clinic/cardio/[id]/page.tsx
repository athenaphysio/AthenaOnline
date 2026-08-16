import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../../clinic.module.css";
import ClinicBrandbar from "../../ClinicBrandbar";
import CardioBlockPageClient from "../CardioBlockPageClient";
import type { CardioBlockDetail } from "@/lib/cardioBlock";

export const dynamic = "force-dynamic";

// Same column list as GET /api/clinic/cardio-blocks/[id] -- kept in sync by
// hand since this is a direct server-side read, not a call to that route.
const COLUMNS =
  "id, name, modality, modality_other, structure, rationale, category, entry_criteria, stop_rule, tier, coaching_note, " +
  "steady_duration_seconds, steady_distance_m, steady_intensity_percent, steady_hr_zone, steady_pace, " +
  "steady_power_watts, steady_cadence, steady_incline_resistance, " +
  "interval_reps, interval_work_seconds, interval_intensities_percent, interval_rest_mode, " +
  "interval_rest_seconds, interval_rest_percent_recovered, interval_rest_type, interval_rest_type_other, " +
  "button_sequence_pm5, button_sequence_pm3_4, review_status, " +
  "impact_level, format, suggested_phase, source_label";

export default async function EditCardioBlockPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data } = await supabaseAdmin.from("cardio_blocks").select(COLUMNS).eq("id", id).maybeSingle<CardioBlockDetail>();

  if (!data) {
    notFound();
  }

  return (
    <div className={styles.app}>
      <div className={styles.wideInner}>
        <ClinicBrandbar />
        <h1 className={styles.heading}>Edit cardio block</h1>

        <CardioBlockPageClient mode="edit" initial={data} />
      </div>
    </div>
  );
}
