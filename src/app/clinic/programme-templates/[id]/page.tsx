import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../../clinic.module.css";
import ProgrammeTemplateBuilder from "../ProgrammeTemplateBuilder";
import type { WorkoutAssignment } from "../../programmes/ProgrammeBuilder";
import ClinicBrandbar from "../../ClinicBrandbar";

type AssignmentRow = {
  workout_id: string;
  day_of_week: number | null;
  workouts: { name: string };
};

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
  programme_template_phases: { name: string; start_week: number; end_week: number; sort_order: number }[];
};

export default async function EditProgrammeTemplatePage({ params }: { params: Promise<{ id: string }> }) {
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
    <div className={styles.app}>
      <div className={styles.wideInner}>
        <ClinicBrandbar />
        <h1 className={styles.heading}>Edit programme template</h1>
        <p className={styles.subheading} style={{ marginTop: -12 }}>
          <Link href={`/clinic/programmes/new?source=template&id=${template.id}`} className={styles.canvasLink}>
            Use this template for a patient
          </Link>{" "}
          ·{" "}
          <Link href={`/clinic/programme-templates/${template.id}/duplicate`} className={styles.canvasLink}>
            Duplicate &amp; retitle
          </Link>
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
  );
}
