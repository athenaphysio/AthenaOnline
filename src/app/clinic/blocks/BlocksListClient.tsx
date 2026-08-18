"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { slotTypeLabel, type SlotType } from "@/lib/slotTypes";
import { categoryMeta } from "@/lib/blockCategory";
import type { BlockUsageTag } from "@/lib/blockUsageTags";
import styles from "../clinic.module.css";
import confirmStyles from "../vault/equipment/EquipmentManager.module.css";
import DrillListToggle from "../builder/DrillListToggle";

export type BlockListCard = {
  id: string;
  name: string;
  type: string;
  block_length_weeks: number;
  drillNames: string[];
  usageTagIds: string[];
  workoutCount: number;
  patientNames: string[];
};

function DeleteBlockAction({ block }: { block: BlockListCard }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/clinic/blocks/${block.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Remove failed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed.");
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        style={{ background: "none", border: "none", padding: 0, font: "inherit", fontSize: 13.5, color: "var(--muted)", cursor: "pointer" }}
      >
        Delete
      </button>
      {error && <span style={{ fontSize: 12.5, color: "var(--crimson)" }}>{error}</span>}

      {confirming && (
        <div className={confirmStyles.confirmOverlay}>
          <div className={confirmStyles.confirmBox}>
            {block.workoutCount > 0 ? (
              <p>
                &ldquo;{block.name}&rdquo; is shared -- it&apos;s used in {block.workoutCount} workout
                {block.workoutCount === 1 ? "" : "s"}
                {block.patientNames.length > 0 ? (
                  <>
                    , including {block.patientNames.length} currently assigned to a real patient (
                    {block.patientNames.join(", ")})
                  </>
                ) : (
                  ", none of them currently assigned to a real patient"
                )}
                . Remove it from {block.workoutCount === 1 ? "that workout" : "those workouts"} first.
              </p>
            ) : (
              <p>Delete &ldquo;{block.name}&rdquo;? This can&apos;t be undone.</p>
            )}
            <div className={confirmStyles.confirmActions}>
              <button type="button" className={styles.buttonSecondary} onClick={() => setConfirming(false)}>
                Cancel
              </button>
              {block.workoutCount === 0 && (
                <button type="button" className={styles.button} onClick={confirmDelete} disabled={deleting}>
                  {deleting ? "Deleting…" : "Delete it"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

type Props = {
  blocks: BlockListCard[];
  usageTagCatalog: BlockUsageTag[];
  filterType?: SlotType;
};

// The general Blocks library, and the pre-filtered Activations and Injury
// Preventions sections, gain a second filter here -- by usage tag, on top
// of whatever type-scoping the page itself already applies server-side.
// Client-side since it's just filtering an already-fetched list, same as
// the Vault Blocks tab's own type filter.
export default function BlocksListClient({ blocks, usageTagCatalog, filterType }: Props) {
  const [usageTagFilter, setUsageTagFilter] = useState("");

  const usageTagsById = useMemo(() => new Map(usageTagCatalog.map((t) => [t.id, t.name])), [usageTagCatalog]);

  const filtered = useMemo(() => {
    if (!usageTagFilter) return blocks;
    return blocks.filter((b) => b.usageTagIds.includes(usageTagFilter));
  }, [blocks, usageTagFilter]);

  return (
    <>
      {usageTagCatalog.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <select
            className={styles.input}
            style={{ maxWidth: 240 }}
            value={usageTagFilter}
            onChange={(e) => setUsageTagFilter(e.target.value)}
          >
            <option value="">Filter by usage tag</option>
            {usageTagCatalog.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {filtered.length === 0 && <p className={styles.notice}>Nothing matches that tag.</p>}

      {filtered.map((b) => {
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
            <DrillListToggle drillNames={b.drillNames} indent={0} />
            {b.usageTagIds.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {b.usageTagIds.map((id) => (
                  <span
                    key={id}
                    style={
                      {
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 100,
                        background: "var(--frost)",
                        color: "var(--stone)",
                      } as CSSProperties
                    }
                  >
                    {usageTagsById.get(id) ?? "…"}
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
              <Link href={`/clinic/blocks/${b.id}`} style={{ color: "var(--crimson)", fontSize: 13.5 }}>
                Edit
              </Link>
              <Link href={`/clinic/blocks/${b.id}/duplicate`} style={{ color: "var(--stone)", fontSize: 13.5 }}>
                Duplicate
              </Link>
              <DeleteBlockAction block={b} />
            </div>
          </div>
        );
      })}
    </>
  );
}
