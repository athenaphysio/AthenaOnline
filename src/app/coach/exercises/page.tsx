import Link from "next/link";
import { requireCoach } from "@/lib/coachAuth";
import { createClient } from "@/lib/supabase/server";
import styles from "../../clinic/clinic.module.css";
import CoachExercisesClient, { type ExerciseRow } from "./CoachExercisesClient";
import AthenaLogo from "@/components/AthenaLogo";

export default async function CoachExercisesPage() {
  await requireCoach();
  const supabase = await createClient();

  // Exercises are public-read for everyone already (0001_initial_schema.sql)
  // -- this isn't a coach-specific grant, just the coach's own client
  // reading a table that's always been open.
  const { data: exercises } = await supabase
    .from("exercises")
    .select("exercise_id, name_clinical, body_site, equipment, difficulty")
    .eq("active", true)
    .order("name_clinical")
    .returns<ExerciseRow[]>();

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <div className={styles.brandbar}>
          <AthenaLogo height={36} />
          <div className={styles.brandname}>Coach</div>
        </div>

        <h1 className={styles.heading}>Exercise library</h1>
        <p className={styles.subheading}>
          <Link href="/coach" style={{ color: "var(--crimson-text, var(--crimson))" }}>
            Back to templates
          </Link>
        </p>

        <CoachExercisesClient initialExercises={exercises ?? []} />
      </div>
    </div>
  );
}
