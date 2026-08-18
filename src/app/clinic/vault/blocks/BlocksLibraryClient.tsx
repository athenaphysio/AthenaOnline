"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SLOT_TYPES, slotTypeLabel } from "@/lib/slotTypes";
import { cardioCategoryLabel, modalityLabel, type BlockCard } from "@/lib/vaultBlocksLibrary";
import type { BlockUsageTag } from "@/lib/blockUsageTags";
import clinicStyles from "../../clinic.module.css";
import confirmStyles from "../equipment/EquipmentManager.module.css";
import styles from "./VaultBlocks.module.css";

export type { BlockCard };

type ExerciseBlockCard = Extract<BlockCard, { kind: "exercise" }>;

function DeleteBlockButton({ block }: { block: ExerciseBlockCard }) {
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
        className={styles.deleteBlockButton}
        onClick={(e) => {
          e.stopPropagation();
          setConfirming(true);
        }}
        aria-label={`Delete ${block.name}`}
      >
        🗑
      </button>

      {confirming && (
        <div className={confirmStyles.confirmOverlay} onClick={(e) => e.stopPropagation()}>
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
            {error && <p style={{ color: "var(--crimson)", fontSize: 12.5 }}>{error}</p>}
            <div className={confirmStyles.confirmActions}>
              <button type="button" className={clinicStyles.buttonSecondary} onClick={() => setConfirming(false)}>
                Cancel
              </button>
              {block.workoutCount === 0 && (
                <button type="button" className={clinicStyles.button} onClick={confirmDelete} disabled={deleting}>
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

// Encodes the filter dropdown's value as "ex:<type>" or "cardio:<category>"
// so one control can filter across both taxonomies without David having to
// pick a kind first.
type FilterValue = "" | `ex:${string}` | `cardio:${string}`;

export default function BlocksLibraryClient({
  blocks,
  usageTagCatalog,
  selectedId,
  onSelect,
}: {
  blocks: BlockCard[];
  usageTagCatalog: BlockUsageTag[];
  selectedId?: string | null;
  onSelect?: (block: BlockCard) => void;
}) {
  const [filter, setFilter] = useState<FilterValue>("");
  const [usageTagFilter, setUsageTagFilter] = useState("");
  const [search, setSearch] = useState("");

  const usageTagsById = useMemo(() => new Map(usageTagCatalog.map((t) => [t.id, t.name])), [usageTagCatalog]);

  const cardioCategories = useMemo(() => {
    const seen = new Set<string>();
    for (const b of blocks) if (b.kind === "cardio") seen.add(b.category);
    return Array.from(seen);
  }, [blocks]);

  const filtered = useMemo(() => {
    return blocks.filter((b) => {
      if (filter) {
        const [kind, value] = filter.split(":");
        if (b.kind !== kind) return false;
        if (b.kind === "exercise" && b.type !== value) return false;
        if (b.kind === "cardio" && b.category !== value) return false;
      }
      // A second, independent filter alongside the type filter above -- a
      // block can be found by what it's actually for regardless of which
      // category it sits in. Cardio blocks never carry usage tags, so this
      // filter simply excludes them when set, same as it would if none matched.
      if (usageTagFilter && (b.kind !== "exercise" || !b.usageTagIds.includes(usageTagFilter))) return false;
      if (search.trim() && !b.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [blocks, filter, usageTagFilter, search]);

  return (
    <div className={`${styles.card} ${styles.library}`}>
      <div className={styles.libraryHead}>
        <h3>
          Block library <span className={styles.libraryCount}>({blocks.length})</span>
        </h3>
        <div className={styles.libraryHeadControls}>
          <select className={styles.typeFilter} value={filter} onChange={(e) => setFilter(e.target.value as FilterValue)}>
            <option value="">Filter by type</option>
            <optgroup label="Exercise blocks">
              {SLOT_TYPES.map((t) => (
                <option key={t.value} value={`ex:${t.value}`}>
                  {t.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Cardio blocks">
              {cardioCategories.map((c) => (
                <option key={c} value={`cardio:${c}`}>
                  {cardioCategoryLabel(c)}
                </option>
              ))}
            </optgroup>
          </select>
          {usageTagCatalog.length > 0 && (
            <select
              className={styles.typeFilter}
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
          )}
          <input
            className={styles.search}
            type="text"
            placeholder="Search blocks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.emptyState}>Nothing matches.</div>
      ) : (
        <div className={styles.blockGrid}>
          {filtered.map((b) =>
            b.kind === "exercise" ? (
              <div
                key={b.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect?.(b)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelect?.(b);
                }}
                className={`${styles.blockCard} ${styles.blockCardExercise} ${b.id === selectedId ? styles.blockCardActive : ""}`}
              >
                <DeleteBlockButton block={b} />
                <div className={styles.blockCardHead}>
                  <span className={`${styles.kindTag} ${styles.kindTagExercise}`}>Exercise block</span>
                  <span className={styles.typeTag}>{slotTypeLabel(b.type)}</span>
                </div>
                <div className={styles.blockName}>{b.name}</div>
                <div className={styles.blockMeta}>
                  {b.exerciseCount} exercise{b.exerciseCount === 1 ? "" : "s"} &middot; {b.weeks} week{b.weeks === 1 ? "" : "s"}
                </div>
                {b.previewNames.length > 0 && (
                  <div className={styles.blockPreview}>{b.previewNames.join(", ")}</div>
                )}
                {b.usageTagIds.length > 0 && (
                  <div className={styles.usageTagRow}>
                    {b.usageTagIds.map((id) => (
                      <span key={id} className={styles.usageTagChip}>
                        {usageTagsById.get(id) ?? "…"}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button
                key={b.id}
                type="button"
                onClick={() => onSelect?.(b)}
                className={`${styles.blockCard} ${styles.blockCardCardio} ${b.id === selectedId ? styles.blockCardActive : ""}`}
              >
                <div className={styles.blockCardHead}>
                  <span className={`${styles.kindTag} ${styles.kindTagCardio}`}>Cardio block</span>
                  <span className={styles.typeTag}>{cardioCategoryLabel(b.category)}</span>
                  {b.reviewStatus === "pending" && <span className={styles.reviewPendingTag}>Pending review</span>}
                </div>
                <div className={styles.blockName}>{b.name}</div>
                <div className={styles.blockMeta}>{modalityLabel(b.modality)}</div>
                <div className={styles.blockPreview}>{b.summary}</div>
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
