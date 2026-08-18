import Link from "next/link";
import type { CSSProperties } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../clinic.module.css";
import ClinicBrandbar from "../ClinicBrandbar";
import WorkoutsListClient, { type WorkoutRow } from "./WorkoutsListClient";

// See the matching comment on src/app/clinic/page.tsx -- this page has no
// dynamic API to trigger dynamic rendering automatically, so without this
// it would freeze at whatever the workout list looked like at build time.
export const dynamic = "force-dynamic";

export default async function WorkoutsListPage() {
  const [{ data: workouts }, { data: programmeLinks }, { data: templateLinks }] = await Promise.all([
    supabaseAdmin.from("workouts").select("id, name, created_at").eq("kind", "standard").order("created_at", { ascending: false }),
    supabaseAdmin.from("programme_workouts").select("workout_id, programmes(patient_id)").returns<
      { workout_id: string; programmes: { patient_id: string } | null }[]
    >(),
    supabaseAdmin.from("programme_template_workouts").select("workout_id").returns<{ workout_id: string }[]>(),
  ]);

  // How many real patients would be affected, and separately whether it's
  // still referenced by a Programme Template (which blocks deletion too,
  // but isn't "a patient" -- see the Phase 3 brief's two-tier warning).
  const patientIdsByWorkout = new Map<string, Set<string>>();
  for (const link of programmeLinks ?? []) {
    if (!link.programmes) continue;
    if (!patientIdsByWorkout.has(link.workout_id)) patientIdsByWorkout.set(link.workout_id, new Set());
    patientIdsByWorkout.get(link.workout_id)!.add(link.programmes.patient_id);
  }
  const templateUseByWorkout = new Map<string, number>();
  for (const link of templateLinks ?? []) {
    templateUseByWorkout.set(link.workout_id, (templateUseByWorkout.get(link.workout_id) ?? 0) + 1);
  }

  const rows: WorkoutRow[] = (workouts ?? []).map((w) => ({
    id: w.id,
    name: w.name,
    patientCount: patientIdsByWorkout.get(w.id)?.size ?? 0,
    templateUseCount: templateUseByWorkout.get(w.id) ?? 0,
  }));

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <ClinicBrandbar />

        <h1 className={styles.heading}>Workouts</h1>
        <p className={styles.subheading}>
          One full session of rehab or strength, built from Blocks (plus any standalone exercises).
        </p>

        <div className={styles.actions} style={{ marginTop: 0, marginBottom: 20 }}>
          <Link
            href="/clinic/workouts/new"
            className={styles.buttonSecondaryAccent}
            style={{ "--zone-accent": "var(--accent-content)", "--zone-accent-soft": "var(--accent-content-soft)" } as CSSProperties}
          >
            + New workout
          </Link>
          <Link
            href="/clinic/workouts/new?kind=cardio"
            className={styles.buttonSecondaryAccent}
            style={{ "--zone-accent": "var(--accent-cardio)", "--zone-accent-soft": "var(--accent-cardio-soft)" } as CSSProperties}
          >
            + New cardio workout
          </Link>
        </div>

        {rows.length === 0 && (
          <p className={styles.notice} style={{ color: "var(--clinic-on-canvas-muted)" }}>
            No workouts yet.
          </p>
        )}

        <WorkoutsListClient workouts={rows} />
      </div>
    </div>
  );
}
