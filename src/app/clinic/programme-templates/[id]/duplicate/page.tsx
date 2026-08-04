import Image from "next/image";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../../../clinic.module.css";
import ProgrammeTemplateBuilder from "../../ProgrammeTemplateBuilder";
import type { WorkoutAssignment } from "../../../programmes/ProgrammeBuilder";
import ClinicBrandbar from "../../../ClinicBrandbar";

type AssignmentRow = {
  workout_id: string;
  day_of_week: number;
  workouts: { name: string };
};

type Template = {
  id: string;
  name: string;
  block_length_weeks: number;
  is_under_18: boolean;
  access: "paid" | "free";
  price_gbp: number | null;
  cover_image_url: string | null;
  programme_template_workouts: AssignmentRow[];
};

export default async function DuplicateProgrammeTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: template } = await supabaseAdmin
    .from("programme_templates")
    .select(
      "id, name, block_length_weeks, is_under_18, access, price_gbp, cover_image_url, programme_template_workouts(workout_id, day_of_week, workouts(name))"
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

  const newTemplateId = crypto.randomUUID();

  return (
    <div className={styles.app}>
      <div className={styles.wideInner}>
        <ClinicBrandbar />
        <h1 className={styles.heading}>Duplicate programme template</h1>
        <p className={styles.subheading}>Copied from &ldquo;{template.name}&rdquo;. Rename it and adjust as needed.</p>

        <ProgrammeTemplateBuilder
          mode="create"
          templateId={newTemplateId}
          initialName={`${template.name} (copy)`}
          initialBlockLengthWeeks={template.block_length_weeks}
          initialAssignments={initialAssignments}
          initialIsUnder18={template.is_under_18}
          initialAccess={template.access}
          initialPriceGBP={template.price_gbp}
          initialCoverImageUrl={template.cover_image_url}
        />
      </div>
    </div>
  );
}
