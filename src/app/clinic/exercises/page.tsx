import Image from "next/image";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../clinic.module.css";
import ExercisesClient, { type ExerciseRow } from "./ExercisesClient";
import ClinicBrandbar from "../ClinicBrandbar";

// See the matching comment on src/app/clinic/page.tsx -- this page has no
// dynamic API to trigger dynamic rendering automatically, so without this
// it would freeze at whatever the exercise library looked like at build
// time.
export const dynamic = "force-dynamic";

export default async function ExercisesPage() {
  const { data: exercises } = await supabaseAdmin
    .from("exercises")
    .select("exercise_id, name_clinical, body_site, equipment, difficulty")
    .eq("active", true)
    .order("name_clinical")
    .returns<ExerciseRow[]>();

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <ClinicBrandbar />

        <h1 className={styles.heading}>Exercises</h1>
        <p className={styles.subheading}>
          The base library — every exercise referenced by Blocks, Workouts and Quick Assign.
        </p>

        <ExercisesClient initialExercises={exercises ?? []} />
      </div>
    </div>
  );
}
