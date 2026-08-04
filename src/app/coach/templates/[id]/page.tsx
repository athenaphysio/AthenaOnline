import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/coachAuth";
import { createClient } from "@/lib/supabase/server";
import { currentWeekNumber } from "@/lib/programmeWeek";
import styles from "../../../clinic/clinic.module.css";
import ProgrammeTemplateBuilder from "../../../clinic/programme-templates/ProgrammeTemplateBuilder";
import type { WorkoutAssignment } from "../../../clinic/programmes/ProgrammeBuilder";

type AssignmentRow = {
  workout_id: string;
  day_of_week: number;
  workouts: { name: string } | null;
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

type RosterRow = {
  id: string;
  patient_first_name: string;
  participant_first_name: string | null;
  participant_age: number | null;
  start_date: string;
  block_length_weeks: number;
};

export default async function CoachTemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCoach();
  const { id } = await params;
  const supabase = await createClient();

  // RLS scopes both of these to exactly what this coach is allowed to see
  // -- a template they aren't assigned to comes back null here, same as a
  // genuinely missing one.
  const [{ data: template }, { data: roster }] = await Promise.all([
    supabase
      .from("programme_templates")
      .select(
        "id, name, block_length_weeks, is_under_18, access, price_gbp, cover_image_url, programme_template_workouts(workout_id, day_of_week, workouts(name))"
      )
      .eq("id", id)
      .maybeSingle<Template>(),
    // Deliberately not selecting guardian_confirmed_at -- that's compliance
    // record-keeping for Owner, not something Coach needs to see.
    supabase
      .from("programmes")
      .select("id, patient_first_name, participant_first_name, participant_age, start_date, block_length_weeks")
      .eq("source_template_id", id)
      .order("start_date", { ascending: false })
      .returns<RosterRow[]>(),
  ]);

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
        workout_name: row.workouts?.name ?? "Workout",
        days: [row.day_of_week],
      });
    }
  }
  const initialAssignments = Array.from(byWorkout.values());

  return (
    <div className={styles.app}>
      <div className={styles.wideInner}>
        <div className={styles.brandbar}>
          <Image src="/icons/athena-mark.png" alt="" width={26} height={26} />
          <div className={styles.brandname}>Athena Physio — Coach</div>
        </div>

        <h1 className={styles.heading}>{template.name}</h1>
        <p className={styles.subheading} style={{ marginTop: -12 }}>
          <Link href="/coach" style={{ color: "var(--crimson)" }}>
            Back to templates
          </Link>
        </p>

        <ProgrammeTemplateBuilder
          mode="edit"
          templateId={template.id}
          initialName={template.name}
          initialBlockLengthWeeks={template.block_length_weeks}
          initialAssignments={initialAssignments}
          initialIsUnder18={template.is_under_18}
          initialAccess={template.access}
          initialPriceGBP={template.price_gbp}
          initialCoverImageUrl={template.cover_image_url}
          apiBasePath="/api/coach/programme-templates"
          workoutSearchEndpoint="/api/coach/workouts/search"
          showWorkoutEditLink={false}
          canEditUnder18Flag={false}
          canEditAccessAndPrice={false}
          canEditCoverImage={false}
        />

        <div className={styles.cardTitle} style={{ marginTop: 28 }}>
          Enrolled
        </div>
        {(!roster || roster.length === 0) && (
          <p className={styles.notice} style={{ color: "var(--clinic-on-canvas-muted)" }}>
            Nobody enrolled on this template yet.
          </p>
        )}
        {(roster ?? []).map((r) => (
          <div key={r.id} className={styles.card} style={{ padding: "12px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14.5, fontWeight: 500 }}>
                {r.participant_first_name || r.patient_first_name}
                {r.participant_age != null && (
                  <span style={{ fontWeight: 400, color: "var(--muted)" }}> · age {r.participant_age}</span>
                )}
              </span>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                Started {new Date(r.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--stone)", marginTop: 4 }}>
              Week {currentWeekNumber(r.start_date, r.block_length_weeks)} of {r.block_length_weeks}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
