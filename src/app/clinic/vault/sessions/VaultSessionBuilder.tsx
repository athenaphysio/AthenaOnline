"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PickerCanvas, { PickerThumb, PickerResultBody } from "../../builder/PickerCanvas";
import { SLOT_TYPES, slotTypeLabel, type SlotType } from "@/lib/slotTypes";
import { cardioCategoryLabel, formatDurationMinutes, type BlockCard } from "@/lib/vaultBlocksLibrary";
import styles from "./VaultSessions.module.css";

type SessionItemKind = "exercise_block" | "cardio_block" | "standalone_exercise";
type SessionEditorItem = { key: string; kind: SessionItemKind; refId: string; name: string; slotType: SlotType };

let keyCounter = 0;
function newKey(): string {
  keyCounter += 1;
  return `new-${Date.now()}-${keyCounter}`;
}

type FilterValue = "" | `ex:${string}` | `cardio:${string}`;

export default function VaultSessionBuilder({
  blocks,
  selectedId,
  onDone,
}: {
  blocks: BlockCard[];
  selectedId: string | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(Boolean(selectedId));
  const [workoutId] = useState(() => selectedId ?? crypto.randomUUID());

  const [name, setName] = useState("");
  const [highLoad, setHighLoad] = useState(false);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<SessionEditorItem[]>([]);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterValue>("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    fetch(`/api/clinic/workouts/${selectedId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setName(data.name);
        setHighLoad(data.high_load);
        setNotes(data.notes ?? "");
        setItems(
          (data.items ?? []).map(
            (item: {
              key: string;
              slot_type: SlotType;
              block_id: string | null;
              block_name: string | null;
              exercise_id: string | null;
              exercise_name: string | null;
              cardio_block_id: string | null;
              cardio_block_name: string | null;
            }) => {
              if (item.block_id) {
                return { key: item.key, kind: "exercise_block" as const, refId: item.block_id, name: item.block_name ?? "Block", slotType: item.slot_type };
              }
              if (item.cardio_block_id) {
                return {
                  key: item.key,
                  kind: "cardio_block" as const,
                  refId: item.cardio_block_id,
                  name: item.cardio_block_name ?? "Cardio block",
                  slotType: item.slot_type,
                };
              }
              return {
                key: item.key,
                kind: "standalone_exercise" as const,
                refId: item.exercise_id!,
                name: item.exercise_name ?? "Exercise",
                slotType: item.slot_type,
              };
            }
          )
        );
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load."))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const blocksById = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks]);

  const cardioCategories = useMemo(() => {
    const seen = new Set<string>();
    for (const b of blocks) if (b.kind === "cardio") seen.add(b.category);
    return Array.from(seen);
  }, [blocks]);

  const pickerItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return blocks.filter((b) => {
      if (filter) {
        const [kind, value] = filter.split(":");
        if (b.kind !== kind) return false;
        if (b.kind === "exercise" && b.type !== value) return false;
        if (b.kind === "cardio" && b.category !== value) return false;
      }
      if (q && !b.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [blocks, filter, query]);

  function addBlock(block: BlockCard) {
    setItems((prev) => [
      ...prev,
      {
        key: newKey(),
        kind: block.kind === "exercise" ? "exercise_block" : "cardio_block",
        refId: block.id,
        name: block.name,
        slotType: block.kind === "exercise" ? (block.type as SlotType) : "main_body",
      },
    ]);
  }

  function moveItem(index: number, direction: -1 | 1) {
    setItems((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  // Only a running total when every item is a cardio block with a
  // calculable duration -- an exercise block or a standalone exercise has
  // no time data anywhere in the real schema, so a partial sum would be
  // misleading rather than genuinely useful. Blank, not guessed.
  const totalDurationSeconds = useMemo(() => {
    let total = 0;
    for (const item of items) {
      if (item.kind !== "cardio_block") return null;
      const block = blocksById.get(item.refId);
      if (!block || block.kind !== "cardio" || block.durationSeconds == null) return null;
      total += block.durationSeconds;
    }
    return items.length > 0 ? total : null;
  }, [items, blocksById]);

  async function handleSave() {
    if (!name.trim()) {
      setError("Session name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        id: workoutId,
        name,
        high_load: highLoad,
        notes: notes || null,
        items: items.map((item, i) => ({
          item_order: i + 1,
          slot_type: item.slotType,
          block_id: item.kind === "exercise_block" ? item.refId : null,
          exercise_id: item.kind === "standalone_exercise" ? item.refId : null,
          cardio_block_id: item.kind === "cardio_block" ? item.refId : null,
          cardio_modality_override: null,
          cardio_modality_other_override: null,
          sets: null,
          reps: null,
          hold_seconds: null,
          percent_max: null,
          frequency: null,
          rationale: null,
        })),
      };

      const res = await fetch(selectedId ? `/api/clinic/workouts/${workoutId}` : "/api/clinic/workouts", {
        method: selectedId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");

      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={`${styles.card} ${styles.builder}`}>
        <h3>Loading…</h3>
      </div>
    );
  }

  const totalLabel = formatDurationMinutes(totalDurationSeconds);

  return (
    <div className={`${styles.card} ${styles.builder} ${styles.darkFormScope}`}>
      <h3>{selectedId ? "Editing session" : "New session"}</h3>

      <div className={styles.field}>
        <label>Session name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Session 1: Lower body strength" />
      </div>

      <label className={styles.highLoadToggle}>
        <input type="checkbox" checked={highLoad} onChange={(e) => setHighLoad(e.target.checked)} />
        High-load day (heavy strength, or a hard interval run)
      </label>

      <div className={styles.durationBanner}>
        {totalLabel
          ? `Estimated duration: ~${totalLabel}`
          : items.length === 0
            ? "Add blocks to see an estimated duration."
            : "Estimated duration not available -- this session includes a block with no time data."}
      </div>

      <PickerCanvas<BlockCard, SessionEditorItem>
        pickerTitle="Block library"
        searchQuery={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search blocks…"
        filters={[
          ...SLOT_TYPES.map((t) => ({ value: `ex:${t.value}`, label: t.label })),
          ...cardioCategories.map((c) => ({ value: `cardio:${c}`, label: cardioCategoryLabel(c) })),
        ]}
        activeFilter={filter}
        onFilterChange={(v) => setFilter(v as FilterValue)}
        pickerItems={pickerItems}
        getPickerItemKey={(b) => b.id}
        renderPickerItem={(b) => (
          <>
            <PickerThumb src={null} label={b.name} />
            <PickerResultBody
              name={b.name}
              tags={[b.kind === "exercise" ? slotTypeLabel(b.type) : cardioCategoryLabel(b.category), b.kind === "cardio" ? "Cardio" : "Exercise block"]}
            />
          </>
        )}
        isAdded={(b) => items.some((i) => i.refId === b.id)}
        onAdd={addBlock}
        pickerEmptyMessage="No blocks match. Build one in the Blocks library first."
        canvasTitle={`This session (${items.length} block${items.length === 1 ? "" : "s"})`}
        canvasItems={items}
        getCanvasItemKey={(item) => item.key}
        renderCanvasItem={(item) => (
          <>
            {item.name}
            {item.kind === "standalone_exercise" && <span className={styles.durationTag}> (standalone exercise)</span>}
          </>
        )}
        onMoveUp={(i) => moveItem(i, -1)}
        onMoveDown={(i) => moveItem(i, 1)}
        onRemove={removeItem}
        canvasEmptyMessage="Add blocks from the library on the left, in the order they should run."
      />

      <div className={styles.field} style={{ marginTop: 18 }}>
        <label>Session notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {error && <div className={styles.saveError}>{error}</div>}
      {saved && !error && <div className={styles.saveNotice}>Saved. It&apos;s live in the library on the right.</div>}

      <div className={styles.builderActions}>
        {selectedId && (
          <button type="button" className={styles.btnGhost} onClick={onDone}>
            Cancel
          </button>
        )}
        <button type="button" className={styles.btnPrimary} disabled={saving} onClick={handleSave}>
          {saving ? "Saving…" : selectedId ? "Save changes" : "Save session"}
        </button>
      </div>
    </div>
  );
}
