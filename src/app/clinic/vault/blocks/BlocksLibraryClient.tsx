"use client";

import { useMemo, useState } from "react";
import { SLOT_TYPES, slotTypeLabel } from "@/lib/slotTypes";
import styles from "./VaultBlocks.module.css";

export type BlockCard =
  | {
      kind: "exercise";
      id: string;
      name: string;
      type: string;
      weeks: number;
      exerciseCount: number;
      previewNames: string[];
    }
  | {
      kind: "cardio";
      id: string;
      name: string;
      category: string;
      tier: string | null;
      modality: string;
      summary: string;
    };

const CARDIO_CATEGORY_LABEL: Record<string, string> = {
  general: "General",
  return_to_run: "Return to Run",
  running_progression: "Running Progression",
  cycling_progression: "Cycling Progression",
};

function cardioCategoryLabel(category: string): string {
  return CARDIO_CATEGORY_LABEL[category] ?? category;
}

const MODALITY_LABEL: Record<string, string> = {
  running: "Running",
  treadmill: "Treadmill",
  outdoor_run: "Outdoor run",
  cycling: "Cycling",
  ski_erg: "Ski erg",
  row_erg: "Row erg",
  cross_trainer: "Cross trainer",
  any: "Any modality",
  other: "Other",
};

function modalityLabel(modality: string): string {
  return MODALITY_LABEL[modality] ?? modality;
}

// Encodes the filter dropdown's value as "ex:<type>" or "cardio:<category>"
// so one control can filter across both taxonomies without David having to
// pick a kind first.
type FilterValue = "" | `ex:${string}` | `cardio:${string}`;

export default function BlocksLibraryClient({
  blocks,
  selectedId,
  onSelect,
}: {
  blocks: BlockCard[];
  selectedId?: string | null;
  onSelect?: (block: BlockCard) => void;
}) {
  const [filter, setFilter] = useState<FilterValue>("");
  const [search, setSearch] = useState("");

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
      if (search.trim() && !b.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [blocks, filter, search]);

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
              <button
                key={b.id}
                type="button"
                onClick={() => onSelect?.(b)}
                className={`${styles.blockCard} ${styles.blockCardExercise} ${b.id === selectedId ? styles.blockCardActive : ""}`}
              >
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
              </button>
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
