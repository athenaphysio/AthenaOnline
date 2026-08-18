import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../../clinic.module.css";
import WorkoutBuilder, { type ExerciseOption } from "../WorkoutBuilder";
import ClinicBrandbar from "../../ClinicBrandbar";
import { cleanWorkoutKind, workoutKindLabel, WORKOUT_KINDS } from "@/lib/workoutKind";

// See the matching comment in clinic/blocks/new/page.tsx -- without this,
// the workoutId below gets baked into a static page at build time and
// reused by every visitor until the next deploy.
export const dynamic = "force-dynamic";

export default async function NewWorkoutPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const kind = cleanWorkoutKind((await searchParams).kind);
  const { data: library } = await supabaseAdmin
    .from("exercises")
    .select("exercise_id, name_clinical, body_site, thumbnail_url")
    .eq("active", true)
    .order("exercise_id");

  const workoutId = crypto.randomUUID();

  return (
    <div className={styles.app}>
      <div className={styles.wideInner}>
        <ClinicBrandbar />
        <h1 className={styles.heading}>New {workoutKindLabel(kind).toLowerCase()}</h1>
        <p className={styles.subheading}>
          {WORKOUT_KINDS.find((k) => k.value === kind)?.blurb} Use it inside any Programme once it&apos;s
          saved.
        </p>

        <WorkoutBuilder
          mode="create"
          workoutId={workoutId}
          initialName=""
          initialItems={[]}
          exerciseLibrary={(library ?? []) as ExerciseOption[]}
          initialBlockDetails={{}}
          initialCardioBlockDetails={{}}
          defaultBlockLengthWeeks={4}
          kind={kind}
        />
      </div>
    </div>
  );
}
