import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../clinic.module.css";
import { slotTypeLabel } from "@/lib/slotTypes";
import ClinicBrandbar from "../ClinicBrandbar";

// See the matching comment on src/app/clinic/page.tsx -- this page has no
// dynamic API to trigger dynamic rendering automatically, so without this
// it would freeze at whatever the block list looked like at build time.
export const dynamic = "force-dynamic";

type BlockRow = {
  id: string;
  name: string;
  type: string;
  block_length_weeks: number;
  created_at: string;
};

export default async function BlocksListPage() {
  const { data } = await supabaseAdmin
    .from("blocks")
    .select("id, name, type, block_length_weeks, created_at")
    .order("created_at", { ascending: false })
    .returns<BlockRow[]>();

  const blocks = data ?? [];

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <ClinicBrandbar />

        <h1 className={styles.heading}>Blocks</h1>
        <p className={styles.subheading}>
          Reusable, typed groups of exercises with their own week-to-week progression — the building
          blocks of a Workout.{" "}
          <Link href="/clinic/content" className={styles.canvasLink}>
            ← Content
          </Link>
        </p>

        <div className={styles.actions} style={{ marginTop: 0, marginBottom: 20 }}>
          <Link
            href="/clinic/blocks/new"
            className={styles.buttonSecondaryAccent}
            style={{ "--zone-accent": "var(--accent-content)", "--zone-accent-soft": "var(--accent-content-soft)" } as CSSProperties}
          >
            + New block
          </Link>
        </div>

        {blocks.length === 0 && (
          <p className={styles.notice} style={{ color: "var(--clinic-on-canvas-muted)" }}>
            No blocks yet.
          </p>
        )}

        {blocks.map((b) => (
          <div key={b.id} className={styles.card} style={{ padding: "14px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className={styles.cardTitle} style={{ margin: 0, fontSize: 16 }}>
                {b.name}
                <span className={styles.exerciseId}>{slotTypeLabel(b.type)}</span>
              </span>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{b.block_length_weeks} week block</span>
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
              <Link href={`/clinic/blocks/${b.id}`} style={{ color: "var(--crimson)", fontSize: 13.5 }}>
                Edit
              </Link>
              <Link href={`/clinic/blocks/${b.id}/duplicate`} style={{ color: "var(--stone)", fontSize: 13.5 }}>
                Duplicate
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
