"use client";

import { useMemo, useState } from "react";
import clinicStyles from "../clinic.module.css";
import { useUnsavedChanges } from "../useUnsavedChanges";
import PickerCanvas, { PickerThumb, PickerResultBody } from "../builder/PickerCanvas";
import WeekGrid from "../builder/WeekGrid";
import WeekTabs from "../builder/WeekTabs";
import { SLOT_TYPES, type SlotType } from "@/lib/slotTypes";
import {
  resizeWeeks,
  newEditorItem,
  isExerciseAdded,
  moveEditorItem,
  removeEditorItem,
  updateWeekField as updateWeekFieldPure,
  changeWeekExercise as changeWeekExercisePure,
  updateNumericField as updateNumericFieldPure,
  type EditorWeek,
  type EditorItem,
  type LibraryExerciseOption,
} from "@/lib/blockItemsEditor";

export type { EditorWeek, EditorItem, LibraryExerciseOption };

export type AiDraftReference = {
  block: string;
  assumptions: string[];
  confirmations: string[];
  created_at: string;
};

export type PhaseTagOption = { id: string; name: string };

type Props = {
  mode: "create" | "edit";
  blockId: string;
  initialName: string;
  initialType: SlotType;
  initialBlockLengthWeeks: number;
  initialItems: EditorItem[];
  aiDraft: AiDraftReference | null;
  exerciseLibrary: LibraryExerciseOption[];
  phaseTags?: PhaseTagOption[];
  initialPhaseId?: string | null;
  initialConditionUseCase?: string | null;
  initialContraindicationFlags?: string | null;
};

export default function BlockBuilder({
  mode,
  blockId,
  initialName,
  initialType,
  initialBlockLengthWeeks,
  initialItems,
  aiDraft,
  exerciseLibrary,
  phaseTags = [],
  initialPhaseId = null,
  initialConditionUseCase = null,
  initialContraindicationFlags = null,
}: Props) {
  const [name, setName] = useState(initialName);
  const [type, setType] = useState<SlotType>(initialType);
  const [blockLengthWeeks, setBlockLengthWeeks] = useState(initialBlockLengthWeeks);
  const [items, setItems] = useState<EditorItem[]>(initialItems);
  const [phaseId, setPhaseId] = useState<string | null>(initialPhaseId);
  const [conditionUseCase, setConditionUseCase] = useState(initialConditionUseCase ?? "");
  const [contraindicationFlags, setContraindicationFlags] = useState(initialContraindicationFlags ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [query, setQuery] = useState("");
  const [bodySiteFilter, setBodySiteFilter] = useState("");
  const [selectedWeek, setSelectedWeek] = useState(1);

  const { markSaved } = useUnsavedChanges({
    name,
    type,
    blockLengthWeeks,
    items,
    phaseId,
    conditionUseCase,
    contraindicationFlags,
  });

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

  function isAdded(exercise: LibraryExerciseOption): boolean {
    return isExerciseAdded(items, exercise);
  }

  function moveItem(index: number, direction: -1 | 1) {
    setItems((prev) => moveEditorItem(prev, index, direction));
  }

  function removeItem(index: number) {
    setItems((prev) => removeEditorItem(prev, index));
  }

  function updateWeekField(itemKey: string, weekNumber: number, patch: Partial<EditorWeek>) {
    setItems((prev) => updateWeekFieldPure(prev, itemKey, weekNumber, patch));
  }

  function changeWeekExercise(itemKey: string, weekNumber: number, exerciseId: string) {
    setItems((prev) => changeWeekExercisePure(prev, itemKey, weekNumber, exerciseId, exerciseLibrary));
  }

  function updateNumericField(
    itemKey: string,
    weekNumber: number,
    field: "sets" | "reps" | "hold_seconds" | "percent_max",
    value: string
  ) {
    setItems((prev) => updateNumericFieldPure(prev, itemKey, weekNumber, field, value));
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        id: blockId,
        name,
        type,
        block_length_weeks: blockLengthWeeks,
        phase_id: phaseId,
        condition_use_case: conditionUseCase.trim() || null,
        contraindication_flags: contraindicationFlags.trim() || null,
        items: items.map((item, i) => ({
          item_order: i + 1,
          weeks: item.weeks.map((w) => ({
            week_number: w.week_number,
            exercise_id: w.exercise_id,
            rationale: w.rationale,
            sets: w.sets,
            reps: w.reps,
            hold_seconds: w.hold_seconds,
            percent_max: w.percent_max,
            frequency: w.frequency,
          })),
        })),
        ...(mode === "create" ? { ai_draft: aiDraft } : {}),
      };

      const res = await fetch(mode === "create" ? "/api/clinic/blocks" : `/api/clinic/blocks/${blockId}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      setSaved(true);
      markSaved({ name, type, blockLengthWeeks, items, phaseId, conditionUseCase, contraindicationFlags });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* A light card, not bare fields on the canvas -- these labels used
          to sit directly on the page background, which only worked while
          that background was pale. */}
      <div className={clinicStyles.card}>
        <div className={clinicStyles.row2}>
          <div className={clinicStyles.field}>
            <label className={clinicStyles.label}>Block name</label>
            <input className={clinicStyles.input} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className={clinicStyles.field}>
            <label className={clinicStyles.label}>Type</label>
            <select
              className={clinicStyles.input}
              value={type}
              onChange={(e) => setType(e.target.value as SlotType)}
            >
              {SLOT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={clinicStyles.row2}>
          <div className={clinicStyles.field}>
            <label className={clinicStyles.label}>Block length (weeks)</label>
            <input
              type="number"
              min={1}
              max={12}
              className={clinicStyles.input}
              style={{ maxWidth: 160 }}
              value={blockLengthWeeks}
              onChange={(e) => updateBlockLength(Number(e.target.value) || 1)}
            />
          </div>
          <div className={clinicStyles.field}>
            <label className={clinicStyles.label}>Programme phase (optional)</label>
            <select
              className={clinicStyles.input}
              value={phaseId ?? ""}
              onChange={(e) => setPhaseId(e.target.value || null)}
            >
              <option value="">Not classified</option>
              {phaseTags.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Indication (optional)</label>
          <textarea
            className={clinicStyles.textarea}
            style={{ minHeight: 70 }}
            value={conditionUseCase}
            onChange={(e) => setConditionUseCase(e.target.value)}
            placeholder="When this block is the right choice."
          />
        </div>

        <div className={clinicStyles.field} style={{ marginBottom: 0 }}>
          <label className={clinicStyles.label}>Contraindications (optional)</label>
          <textarea
            className={clinicStyles.textarea}
            style={{ minHeight: 70 }}
            value={contraindicationFlags}
            onChange={(e) => setContraindicationFlags(e.target.value)}
            placeholder="When to avoid or adapt this block."
          />
        </div>
      </div>

      <WeekTabs
        weekNumbers={Array.from({ length: blockLengthWeeks }, (_, i) => i + 1)}
        selectedWeek={selectedWeek}
        onSelectWeek={setSelectedWeek}
      />

      {aiDraft && (
        <div className={clinicStyles.draftRefCard}>
          <div className={clinicStyles.draftRefTitle}>
            Original AI draft — {new Date(aiDraft.created_at).toLocaleString()}
          </div>
          <p style={{ fontSize: 13.5, color: "var(--stone)", marginBottom: 10 }}>{aiDraft.block}</p>
          <div className={clinicStyles.smallLabel}>Assumptions made</div>
          <ul className={clinicStyles.list}>
            {aiDraft.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
          <div className={clinicStyles.smallLabel}>What only you can confirm</div>
          <ul className={clinicStyles.list}>
            {aiDraft.confirmations.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <PickerCanvas<LibraryExerciseOption, EditorItem>
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
        isAdded={isAdded}
        onAdd={addItem}
        pickerEmptyMessage="No exercises match."
        canvasTitle={`This block (${items.length} exercise${items.length === 1 ? "" : "s"})`}
        canvasItems={items}
        getCanvasItemKey={(item) => item.key}
        renderCanvasItem={(item) => item.weeks[0]?.name ?? "Exercise"}
        onMoveUp={(i) => moveItem(i, -1)}
        onMoveDown={(i) => moveItem(i, 1)}
        onRemove={removeItem}
        canvasEmptyMessage="Add exercises from the library on the left."
        canvasRowExtra={(item) => {
          const week = item.weeks.find((w) => w.week_number === selectedWeek);
          if (!week) return null;
          return (
            <WeekGrid
              week={week}
              exerciseLibrary={exerciseLibrary}
              onChangeExercise={(weekNumber, exerciseId) => changeWeekExercise(item.key, weekNumber, exerciseId)}
              onChangeField={(weekNumber, patch) => updateWeekField(item.key, weekNumber, patch)}
              onChangeNumeric={(weekNumber, field, value) => updateNumericField(item.key, weekNumber, field, value)}
            />
          );
        }}
      />

      {error && <div className={clinicStyles.error} style={{ marginTop: 16 }}>{error}</div>}

      <button
        type="button"
        className={clinicStyles.button}
        style={{ marginTop: 20 }}
        disabled={saving || !name.trim() || items.length === 0}
        onClick={handleSubmit}
      >
        {saving ? "Saving…" : saved ? "Save changes" : "Save block"}
      </button>

      {saved && (
        <div className={clinicStyles.shareLinkCard}>
          <div className={clinicStyles.smallLabel}>Saved</div>
          <div className={clinicStyles.shareLinkText}>
            &ldquo;{name}&rdquo; is in your Block library, ready to use in a Workout.
          </div>
          {mode === "create" && (
            // A real navigation, not client-side routing -- guarantees a
            // fresh server-generated id for the next block rather than
            // risking a cached router payload reusing this one's.
            <a
              href={`/clinic/blocks/new?type=${type}`}
              className={clinicStyles.buttonSecondary}
              style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
            >
              Start a new block
            </a>
          )}
        </div>
      )}
    </div>
  );
}
