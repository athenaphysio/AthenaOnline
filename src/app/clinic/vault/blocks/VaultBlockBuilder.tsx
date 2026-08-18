"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SLOT_TYPES, type SlotType } from "@/lib/slotTypes";
import PickerCanvas, { PickerThumb, PickerResultBody } from "../../builder/PickerCanvas";
import WeekGrid from "../../builder/WeekGrid";
import WeekTabs from "../../builder/WeekTabs";
import CardioBlockEditor from "../../builder/CardioBlockEditor";
import {
  resizeWeeks,
  newEditorItem,
  isExerciseAdded,
  moveEditorItem,
  removeEditorItem,
  updateWeekField as updateWeekFieldPure,
  changeWeekExercise as changeWeekExercisePure,
  updateNumericField as updateNumericFieldPure,
  type EditorItem,
  type LibraryExerciseOption,
} from "@/lib/blockItemsEditor";
import { CARDIO_CATEGORIES, newCardioBlockDetail, type CardioBlockDetail, type CardioCategory } from "@/lib/cardioBlock";
import type { BlockCard } from "./BlocksLibraryClient";
import styles from "./VaultBlocks.module.css";

type Kind = "exercise" | "cardio";
type Selected = { kind: Kind; id: string } | null;

export default function VaultBlockBuilder({
  exerciseLibrary,
  selected,
  onDone,
}: {
  exerciseLibrary: LibraryExerciseOption[];
  selected: Selected;
  onDone: () => void;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>(selected?.kind ?? "exercise");
  const [loading, setLoading] = useState(Boolean(selected));

  const [blockId] = useState(() => selected?.id ?? crypto.randomUUID());

  const [name, setName] = useState("");
  const [type, setType] = useState<SlotType>("main_body");
  const [blockLengthWeeks, setBlockLengthWeeks] = useState(4);
  const [items, setItems] = useState<EditorItem[]>([]);
  const [progressionEnabled, setProgressionEnabled] = useState(false);
  const [notes, setNotes] = useState("");
  const [query, setQuery] = useState("");
  const [bodySiteFilter, setBodySiteFilter] = useState("");
  const [selectedWeek, setSelectedWeek] = useState(1);

  const [cardio, setCardio] = useState<CardioBlockDetail>(() => newCardioBlockDetail(blockId, "", "any", "steady_state"));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;

    async function load() {
      try {
        if (selected!.kind === "exercise") {
          const res = await fetch(`/api/clinic/blocks/${selected!.id}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Failed to load block.");
          if (cancelled) return;
          setName(data.name);
          setType(data.type);
          setBlockLengthWeeks(data.block_length_weeks);
          setNotes(data.notes ?? "");
          setItems(data.items);
          // Real progression only exists if any item's fetched weeks carry
          // more than one row -- a block saved flat (progression off) only
          // ever has a single week_number=1 row per item.
          setProgressionEnabled(data.items.some((item: EditorItem) => item.weeks.length > 1));
        } else {
          const res = await fetch(`/api/clinic/cardio-blocks/${selected!.id}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Failed to load cardio block.");
          if (cancelled) return;
          setCardio(data);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bodySiteFilters = useMemo(() => {
    const sites = new Set(exerciseLibrary.map((e) => e.body_site).filter((s): s is string => Boolean(s)));
    return Array.from(sites)
      .sort()
      .map((s) => ({ value: s, label: s }));
  }, [exerciseLibrary]);

  const pickerItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exerciseLibrary
      .filter((e) => (bodySiteFilter ? e.body_site === bodySiteFilter : true))
      .filter((e) => (q ? e.name_clinical.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name_clinical.localeCompare(b.name_clinical));
  }, [exerciseLibrary, query, bodySiteFilter]);

  function updateBlockLength(n: number) {
    const clamped = Math.max(1, Math.min(12, n));
    setBlockLengthWeeks(clamped);
    setItems((prev) => prev.map((item) => ({ ...item, weeks: resizeWeeks(item.weeks, clamped) })));
    setSelectedWeek((prev) => Math.min(prev, clamped));
  }

  function addItem(exercise: LibraryExerciseOption) {
    setItems((prev) => [...prev, newEditorItem(exercise, blockLengthWeeks)]);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (kind === "exercise") {
        if (!name.trim()) throw new Error("Block name is required.");
        if (items.length === 0) throw new Error("Add at least one exercise.");

        const payload = {
          id: blockId,
          name,
          type,
          block_length_weeks: blockLengthWeeks,
          notes: notes || null,
          items: items.map((item, i) => ({
            item_order: i + 1,
            weeks: (progressionEnabled ? item.weeks : item.weeks.slice(0, 1)).map((w) => ({
              week_number: progressionEnabled ? w.week_number : 1,
              exercise_id: w.exercise_id,
              rationale: w.rationale,
              sets: w.sets,
              reps: w.reps,
              hold_seconds: w.hold_seconds,
              percent_max: w.percent_max,
              frequency: w.frequency,
            })),
          })),
        };

        const res = await fetch(selected ? `/api/clinic/blocks/${blockId}` : "/api/clinic/blocks", {
          method: selected ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Save failed.");
      } else {
        if (!cardio.name.trim()) throw new Error("Block name is required.");

        if (!selected) {
          const createRes = await fetch("/api/clinic/cardio-blocks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: blockId,
              name: cardio.name,
              modality: cardio.modality,
              modality_other: cardio.modality_other,
              structure: cardio.structure,
              category: cardio.category,
            }),
          });
          const createData = await createRes.json();
          if (!createRes.ok) throw new Error(createData.error || "Save failed.");
        }

        const res = await fetch(`/api/clinic/cardio-blocks/${blockId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cardio),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Save failed.");
      }

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

  return (
    <div className={`${styles.card} ${styles.builder} ${styles.darkFormScope}`}>
      <h3>{selected ? "Editing block" : "New block"}</h3>

      {!selected && (
        <div className={styles.kindToggle}>
          <button
            type="button"
            className={`${styles.kindToggleBtn} ${kind === "exercise" ? styles.kindToggleBtnActive : ""}`}
            onClick={() => setKind("exercise")}
          >
            Exercise block
          </button>
          <button
            type="button"
            className={`${styles.kindToggleBtn} ${kind === "cardio" ? styles.kindToggleBtnActive : ""}`}
            onClick={() => setKind("cardio")}
          >
            Cardio block
          </button>
        </div>
      )}

      {kind === "exercise" ? (
        <>
          <div className={styles.row2}>
            <div className={styles.field}>
              <label>Block name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as SlotType)}>
                {SLOT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label>Block length (weeks)</label>
            <input
              type="number"
              min={1}
              max={12}
              style={{ maxWidth: 160 }}
              value={blockLengthWeeks}
              onChange={(e) => updateBlockLength(Number(e.target.value) || 1)}
            />
          </div>

          <label className={styles.progressionToggle}>
            <input type="checkbox" checked={progressionEnabled} onChange={(e) => setProgressionEnabled(e.target.checked)} />
            Per-week progression (different prescription for each week)
          </label>

          {progressionEnabled && (
            <WeekTabs
              weekNumbers={Array.from({ length: blockLengthWeeks }, (_, i) => i + 1)}
              selectedWeek={selectedWeek}
              onSelectWeek={setSelectedWeek}
            />
          )}

          <PickerCanvas<LibraryExerciseOption, EditorItem>
            emphasis="canvas"
            pickerTitle="Exercise library"
            searchQuery={query}
            onSearchChange={setQuery}
            searchPlaceholder="Search exercises…"
            filters={bodySiteFilters}
            activeFilter={bodySiteFilter}
            onFilterChange={setBodySiteFilter}
            pickerItems={pickerItems}
            getPickerItemKey={(e) => e.exercise_id}
            renderPickerItem={(e) => (
              <>
                <PickerThumb src={e.thumbnail_url} label={e.name_clinical} />
                <PickerResultBody name={e.name_clinical} tags={[e.body_site]} />
              </>
            )}
            isAdded={(e) => isExerciseAdded(items, e)}
            onAdd={addItem}
            pickerEmptyMessage="No exercises match."
            canvasTitle={`This block (${items.length} exercise${items.length === 1 ? "" : "s"})`}
            canvasItems={items}
            getCanvasItemKey={(item) => item.key}
            renderCanvasItem={(item) => item.weeks[0]?.name ?? "Exercise"}
            onMoveUp={(i) => setItems((prev) => moveEditorItem(prev, i, -1))}
            onMoveDown={(i) => setItems((prev) => moveEditorItem(prev, i, 1))}
            onRemove={(i) => setItems((prev) => removeEditorItem(prev, i))}
            canvasEmptyMessage="Add exercises from the library on the left."
            canvasRowExtra={(item) => {
              const week = progressionEnabled ? item.weeks.find((w) => w.week_number === selectedWeek) : item.weeks[0];
              if (!week) return null;
              return (
                <WeekGrid
                  week={week}
                  exerciseLibrary={exerciseLibrary}
                  onChangeExercise={(weekNumber, exerciseId) =>
                    setItems((prev) => changeWeekExercisePure(prev, item.key, weekNumber, exerciseId, exerciseLibrary))
                  }
                  onChangeField={(weekNumber, patch) => setItems((prev) => updateWeekFieldPure(prev, item.key, weekNumber, patch))}
                  onChangeNumeric={(weekNumber, field, value) =>
                    setItems((prev) => updateNumericFieldPure(prev, item.key, weekNumber, field, value))
                  }
                />
              );
            }}
          />

          <div className={styles.field} style={{ marginTop: 18 }}>
            <label>Block notes (general coaching guidance for the whole block)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </>
      ) : (
        <>
          <div className={styles.field}>
            <label>Category</label>
            <select
              value={cardio.category}
              onChange={(e) => setCardio({ ...cardio, category: e.target.value as CardioCategory })}
            >
              {CARDIO_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <CardioBlockEditor cardio={cardio} onChange={(patch) => setCardio((prev) => ({ ...prev, ...patch }))} />
        </>
      )}

      {error && <div className={styles.saveError}>{error}</div>}
      {saved && !error && <div className={styles.saveNotice}>Saved. It&apos;s live in the library on the right.</div>}

      <div className={styles.builderActions}>
        {selected && (
          <button type="button" className={styles.btnGhost} onClick={onDone}>
            Cancel
          </button>
        )}
        <button type="button" className={styles.btnPrimary} disabled={saving} onClick={handleSave}>
          {saving ? "Saving…" : selected ? "Save changes" : "Save block"}
        </button>
      </div>
    </div>
  );
}
