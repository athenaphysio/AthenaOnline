import Link from "next/link";
import type { CSSProperties } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../clinic.module.css";
import { slotTypeLabel, type SlotType } from "@/lib/slotTypes";
import { categoryMeta } from "@/lib/blockCategory";
import ClinicBrandbar from "../ClinicBrandbar";
import DrillListToggle from "../builder/DrillListToggle";

type BlockItemRow = {
  item_order: number;
  block_item_weeks: { week_number: number; exercises: { name_clinical: string } | null }[];
};

type BlockRow = {
  id: string;
  name: string;
  type: string;
  block_length_weeks: number;
  created_at: string;
  block_items: BlockItemRow[];
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
    .select(
      "id, name, type, block_length_weeks, created_at, block_items(item_order, block_item_weeks(week_number, exercises(name_clinical)))"
    )
    .order("created_at", { ascending: false });
  if (filterType) query = query.eq("type", filterType);

  const { data } = await query.returns<BlockRow[]>();
  const blocks = data ?? [];
  const newHref = filterType ? `/clinic/blocks/new?type=${filterType}` : "/clinic/blocks/new";

  function drillNamesFor(block: BlockRow): string[] {
    return [...block.block_items]
      .sort((a, b) => a.item_order - b.item_order)
      .map((item) => {
        const week1 = item.block_item_weeks.find((w) => w.week_number === 1) ?? item.block_item_weeks[0];
        return week1?.exercises?.name_clinical ?? null;
      })
      .filter((n): n is string => Boolean(n));
  }

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <ClinicBrandbar />

        <h1 className={styles.heading}>{heading}</h1>
        <p className={styles.subheading}>{subheading}</p>

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

        {blocks.map((b) => {
          const meta = categoryMeta(b.type as SlotType);
          return (
            <div
              key={b.id}
              className={styles.card}
              style={{ padding: "14px 18px", borderLeft: meta ? `4px solid ${meta.accent}` : undefined }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className={styles.cardTitle} style={{ margin: 0, fontSize: 16 }}>
                  {b.name}
                  {!filterType && meta && (
                    <span className={styles.exerciseId} style={{ background: meta.accentSoft, color: meta.accent }}>
                      {slotTypeLabel(b.type)}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{b.block_length_weeks} week block</span>
              </div>
              <DrillListToggle drillNames={drillNamesFor(b)} indent={0} />
              <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
                <Link href={`/clinic/blocks/${b.id}`} style={{ color: "var(--crimson)", fontSize: 13.5 }}>
                  Edit
                </Link>
                <Link href={`/clinic/blocks/${b.id}/duplicate`} style={{ color: "var(--stone)", fontSize: 13.5 }}>
                  Duplicate
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
