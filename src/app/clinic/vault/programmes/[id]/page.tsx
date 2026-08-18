import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClinicBrandbar from "../../../ClinicBrandbar";
import VaultTabs from "../../VaultTabs";
import ProgrammeTemplateBuilder from "../../../programme-templates/ProgrammeTemplateBuilder";
import type { WorkoutAssignment } from "../../../programmes/ProgrammeBuilder";
import libraryStyles from "../../VaultLibrary.module.css";
import styles from "../VaultProgrammes.module.css";

export const dynamic = "force-dynamic";

type AssignmentRow = { workout_id: string; day_of_week: number | null; workouts: { name: string } };
type PhaseRow = { name: string; start_week: number; end_week: number; sort_order: number };

type Template = {
  id: string;
  name: string;
  block_length_weeks: number;
  is_under_18: boolean;
  delivery_mode: "scheduled" | "open";
  access: "paid" | "free";
  price_gbp: number | null;
  cover_image_url: string | null;
  programme_template_workouts: AssignmentRow[];
  programme_template_phases: PhaseRow[];
};

export default async function EditVaultProgrammeTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: template } = await supabaseAdmin
    .from("programme_templates")
    .select(
      "id, name, block_length_weeks, is_under_18, delivery_mode, access, price_gbp, cover_image_url, programme_template_workouts(workout_id, day_of_week, workouts(name)), programme_template_phases(name, start_week, end_week, sort_order)"
    )
    .eq("id", id)
    .maybeSingle<Template>();

  if (!template) {
    notFound();
  }

  const byWorkout = new Map<string, WorkoutAssignment>();
  for (const row of template.programme_template_workouts) {
    const existing = byWorkout.get(row.workout_id);
    if (existing) {
      existing.days.push(row.day_of_week);
    } else {
      byWorkout.set(row.workout_id, {
        key: row.workout_id,
        workout_id: row.workout_id,
        workout_name: row.workouts.name,
        days: [row.day_of_week],
      });
    }
  }
  const initialAssignments = Array.from(byWorkout.values());
  const initialPhases = [...template.programme_template_phases].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className={libraryStyles.page}>
      <div className={libraryStyles.wrap}>
        <ClinicBrandbar />

        <div className={libraryStyles.topbar}>
          <div>
            <h1>Vault</h1>
            <div className={libraryStyles.sub}>Build and manage your reusable exercises, blocks, workouts, and programmes</div>
          </div>
        </div>

        <VaultTabs active="programmes" />

        <div className={`${styles.card} ${styles.darkFormScope}`} style={{ padding: "26px 28px" }}>
          <h3 style={{ marginBottom: 8 }}>Editing {template.name}</h3>
          <p className={styles.builderIntro} style={{ marginTop: 0 }}>
            <Link href={`/clinic/programmes/new?source=template&id=${template.id}`}>Use this template for a patient</Link>
          </p>

          <ProgrammeTemplateBuilder
            mode="edit"
            templateId={template.id}
            initialName={template.name}
            initialBlockLengthWeeks={template.block_length_weeks}
            initialAssignments={initialAssignments}
            initialPhases={initialPhases}
            initialIsUnder18={template.is_under_18}
            initialDeliveryMode={template.delivery_mode}
            initialAccess={template.access}
            initialPriceGBP={template.price_gbp}
            initialCoverImageUrl={template.cover_image_url}
          />
        </div>
      </div>
    </div>
  );
}
