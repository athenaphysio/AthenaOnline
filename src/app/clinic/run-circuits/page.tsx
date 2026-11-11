import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadCircuitLibrary } from "@/lib/runCircuitServer";
import styles from "../clinic.module.css";
import ClinicBrandbar from "../ClinicBrandbar";
import RunCircuitsClient from "./RunCircuitsClient";
import type { ExerciseChoice } from "./CircuitExerciseEditor";

export const dynamic = "force-dynamic";

// The Run Circuit library: circuit blocks built from the exercise library,
// and phase sets of blocks. The Programme Builder project chooses from
// these by name; it never changes what is inside a block.
export default async function RunCircuitsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const params = await searchParams;
  const [library, { data: exercises }] = await Promise.all([
    loadCircuitLibrary(),
    supabaseAdmin
      .from("exercises")
      .select("exercise_id, name_clinical")
      .eq("active", true)
      .order("name_clinical")
      .returns<ExerciseChoice[]>(),
  ]);

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <ClinicBrandbar />
        <h1 className={styles.heading}>Run Circuits</h1>
        <p className={styles.subheading}>
          Circuit blocks for return to running clients. Each block starts with a run slot, which the Programme Builder fills in with the run time, effort
          or treadmill speed, and the walk afterwards. The exercises and doses in a block are yours alone: plan code can choose blocks, their order and the
          number of rounds, but it can never add or change an exercise.
        </p>
        <RunCircuitsClient initialLibrary={library} exercises={exercises ?? []} startNewBlock={params.new === "block"} />
      </div>
    </div>
  );
}
