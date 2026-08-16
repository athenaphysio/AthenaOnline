import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../clinic.module.css";
import ClinicBrandbar from "../ClinicBrandbar";

// See the matching comment on src/app/clinic/page.tsx -- this page has no
// dynamic API to trigger dynamic rendering automatically, so without this
// it would freeze at whatever the workout list looked like at build time.
export const dynamic = "force-dynamic";

type WorkoutRow = {
  id: string;
  name: string;
  created_at: string;
};

export default async function WorkoutsListPage() {
  const { data } = await supabaseAdmin
    .from("workouts")
    .select("id, name, created_at")
    .order("created_at", { ascending: false })
    .returns<WorkoutRow[]>();

  const workouts = data ?? [];

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
        </div>

        {workouts.length === 0 && (
          <p className={styles.notice} style={{ color: "var(--clinic-on-canvas-muted)" }}>
            No workouts yet.
          </p>
        )}

        {workouts.map((w) => (
          <div key={w.id} className={styles.card} style={{ padding: "14px 18px" }}>
            <span className={styles.cardTitle} style={{ margin: 0, fontSize: 16 }}>
              {w.name}
            </span>
            <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
              <Link href={`/clinic/workouts/${w.id}`} style={{ color: "var(--crimson)", fontSize: 13.5 }}>
                Edit
              </Link>
              <Link
                href={`/clinic/workouts/${w.id}/duplicate`}
                style={{ color: "var(--stone)", fontSize: 13.5 }}
              >
                Duplicate
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
