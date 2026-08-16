import Link from "next/link";
import type { CSSProperties } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../clinic.module.css";
import { slotTypeLabel, type SlotType } from "@/lib/slotTypes";
import ClinicBrandbar from "../ClinicBrandbar";

type BlockRow = {
  id: string;
  name: string;
  type: string;
  block_length_weeks: number;
  created_at: string;
};

type Props = {
  filterType?: SlotType;
  heading: string;
  subheading: string;
  emptyMessage: string;
};

// Shared by the general Blocks list and the pre-filtered Activations and
// Injury Preventions sections -- one query, one builder underneath, just
// scoped by an optional type filter so a section only ever shows its own
// category rather than everything.
export default async function BlocksListView({ filterType, heading, subheading, emptyMessage }: Props) {
  let query = supabaseAdmin
    .from("blocks")
    .select("id, name, type, block_length_weeks, created_at")
    .order("created_at", { ascending: false });
  if (filterType) query = query.eq("type", filterType);

  const { data } = await query.returns<BlockRow[]>();
  const blocks = data ?? [];
  const newHref = filterType ? `/clinic/blocks/new?type=${filterType}` : "/clinic/blocks/new";

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <ClinicBrandbar />

        <h1 className={styles.heading}>{heading}</h1>
        <p className={styles.subheading}>
          {subheading}{" "}
          <Link href="/clinic/content" className={styles.canvasLink}>
            ← Content
          </Link>
        </p>

        <div className={styles.actions} style={{ marginTop: 0, marginBottom: 20 }}>
          <Link
            href={newHref}
            className={styles.buttonSecondaryAccent}
            style={{ "--zone-accent": "var(--accent-content)", "--zone-accent-soft": "var(--accent-content-soft)" } as CSSProperties}
          >
            + New block
          </Link>
        </div>

        {blocks.length === 0 && (
          <p className={styles.notice} style={{ color: "var(--clinic-on-canvas-muted)" }}>
            {emptyMessage}
          </p>
        )}

        {blocks.map((b) => (
          <div key={b.id} className={styles.card} style={{ padding: "14px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className={styles.cardTitle} style={{ margin: 0, fontSize: 16 }}>
                {b.name}
                {!filterType && <span className={styles.exerciseId}>{slotTypeLabel(b.type)}</span>}
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
