"use client";

import { useMemo, useState } from "react";
import clinicStyles from "../clinic.module.css";
import { useUnsavedChanges } from "../useUnsavedChanges";
import { PickerThumb, PickerResultBody } from "../builder/PickerCanvas";
import BuilderShell from "../builder/BuilderShell";
import WeekGrid from "../builder/WeekGrid";
import WeekTabs from "../builder/WeekTabs";
import { categoryMeta } from "@/lib/blockCategory";
import { SLOT_TYPES, type SlotType } from "@/lib/slotTypes";
import { SEQUENCE_TYPES, badgeForSequenceType, type SequenceType } from "@/lib/sequenceType";
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
import styles from "./BlockBuilder.module.css";

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
  initialSequenceType?: SequenceType;
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
  initialSequenceType = "straight_sets",
}: Props) {
  const [name, setName] = useState(initialName);
  const [type, setType] = useState<SlotType>(initialType);
  const [blockLengthWeeks, setBlockLengthWeeks] = useState(initialBlockLengthWeeks);
  const [items, setItems] = useState<EditorItem[]>(initialItems);
  const [phaseId, setPhaseId] = useState<string | null>(initialPhaseId);
  const [conditionUseCase, setConditionUseCase] = useState(initialConditionUseCase ?? "");
  const [contraindicationFlags, setContraindicationFlags] = useState(initialContraindicationFlags ?? "");
  const [sequenceType, setSequenceType] = useState<SequenceType>(initialSequenceType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [query, setQuery] = useState("");
  const [bodySiteFilter, setBodySiteFilter] = useState("");
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const { markSaved } = useUnsavedChanges({
    name,
    type,
    blockLengthWeeks,
    items,
    phaseId,
    conditionUseCase,
    contraindicationFlags,
    sequenceType,
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
        sequence_type: sequenceType,
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
      markSaved({ name, type, blockLengthWeeks, items, phaseId, conditionUseCase, contraindicationFlags, sequenceType });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const meta = categoryMeta(type);
  const accent = meta?.accent ?? "var(--graphite)";
  const badge = badgeForSequenceType(sequenceType);

  const libraryPane = (
    <>
        <div className={styles.pickerSearchRow}>
          <input
            className={clinicStyles.input}
            placeholder="Search exercises…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className={clinicStyles.input}
            style={{ maxWidth: 200 }}
            value={bodySiteFilter}
            onChange={(e) => setBodySiteFilter(e.target.value)}
          >
            <option value="">All body sites</option>
            {bodySiteFilters.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.pickerResults}>
          {pickerItems.map((e) => {
            const added = isAdded(e);
            return (
              <div key={e.exercise_id} className={styles.pickerResultRow}>
                <PickerThumb src={e.thumbnail_url} label={e.name_clinical} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <PickerResultBody name={e.name_clinical} tags={[e.body_site]} />
                </div>
                {added ? (
                  <span style={{ fontSize: 12.5, color: "var(--graphite)" }}>✓ Added</span>
                ) : (
                  <button
                    type="button"
                    className={clinicStyles.buttonSecondary}
                    style={{ width: "auto", padding: "0 16px", height: 36 }}
                    onClick={() => addItem(e)}
                  >
                    Add
                  </button>
                )}
              </div>
            );
          })}
          {pickerItems.length === 0 && <div className={clinicStyles.notice}>No exercises match.</div>}
        </div>

    </>
  );

  const centrePane = (
    <>
        {aiDraft && (
          <div className={clinicStyles.draftRefCard}>
            <div className={clinicStyles.draftRefTitle}>
              Original AI draft, {new Date(aiDraft.created_at).toLocaleString()}
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

        {/* ============ Live preview -- "replica of client view" ============ */}
        <div className={styles.centrePane}>
          <div className={styles.centrePaneTitle}>Replica of client view</div>

          {items.length > 0 && (
            <WeekTabs
              weekNumbers={Array.from({ length: blockLengthWeeks }, (_, i) => i + 1)}
              selectedWeek={selectedWeek}
              onSelectWeek={setSelectedWeek}
            />
          )}

          {items.length === 0 ? (
            <div className={styles.emptyState}>Add exercises from the library above to build this block.</div>
          ) : (
            <div className={styles.previewCard} style={{ marginTop: items.length > 0 ? 14 : 0 }}>
              <div className={styles.previewCardHeader} style={{ background: accent }}>
                <span className={styles.previewCardName}>{name || "Untitled block"}</span>
                {badge && <span className={styles.seqBadge}>{badge}</span>}
              </div>
              <div className={styles.previewCardBody}>
                {items.map((item, index) => {
                  const week = item.weeks.find((w) => w.week_number === selectedWeek);
                  const isExpanded = expandedKey === item.key;
                  return (
                    <div key={item.key} className={styles.exerciseRow}>
                      <div
                        className={styles.exerciseRowHeader}
                        onClick={() => setExpandedKey(isExpanded ? null : item.key)}
                      >
                        <span className={styles.exerciseRowName}>{item.weeks[0]?.name ?? "Exercise"}</span>
                        <div className={styles.exerciseRowControls} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className={styles.iconButton}
                            onClick={() => moveItem(index, -1)}
                            disabled={index === 0}
                            aria-label="Move up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className={styles.iconButton}
                            onClick={() => moveItem(index, 1)}
                            disabled={index === items.length - 1}
                            aria-label="Move down"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className={styles.iconButtonDanger}
                            onClick={() => removeItem(index)}
                            aria-label="Remove"
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                      {isExpanded && week && (
                        <div className={styles.exerciseRowExtra}>
                          <WeekGrid
                            week={week}
                            exerciseLibrary={exerciseLibrary}
                            onChangeExercise={(weekNumber, exerciseId) => changeWeekExercise(item.key, weekNumber, exerciseId)}
                            onChangeField={(weekNumber, patch) => updateWeekField(item.key, weekNumber, patch)}
                            onChangeNumeric={(weekNumber, field, value) => updateNumericField(item.key, weekNumber, field, value)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
    </>
  );

  const controlsPane = (
    <>

        <div className={styles.controlCard}>
          <div className={styles.controlCardTitle}>Block name</div>
          <input className={styles.bigInput} value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className={styles.controlCard}>
          <div className={styles.controlCardTitle}>Type</div>
          <select className={styles.bigInput} value={type} onChange={(e) => setType(e.target.value as SlotType)}>
            {SLOT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.controlCard}>
          <div className={styles.controlCardTitle}>Block length (weeks)</div>
          <div className={styles.stepperRow}>
            <button
              type="button"
              className={styles.stepperButton}
              disabled={blockLengthWeeks <= 1}
              onClick={() => updateBlockLength(blockLengthWeeks - 1)}
            >
              −
            </button>
            <div className={styles.stepperValue}>{blockLengthWeeks}</div>
            <button
              type="button"
              className={styles.stepperButton}
              disabled={blockLengthWeeks >= 12}
              onClick={() => updateBlockLength(blockLengthWeeks + 1)}
            >
              +
            </button>
            <span className={styles.stepperUnit}>weeks</span>
          </div>
        </div>

        <div className={styles.controlCard}>
          <div className={styles.controlCardTitle}>Programme phase</div>
          <select className={styles.bigInput} value={phaseId ?? ""} onChange={(e) => setPhaseId(e.target.value || null)}>
            <option value="">Not classified</option>
            {phaseTags.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.controlCard}>
          <div className={styles.controlCardTitle}>Sequence type</div>
          <select
            className={styles.bigInput}
            value={sequenceType}
            onChange={(e) => setSequenceType(e.target.value as SequenceType)}
          >
            {SEQUENCE_TYPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <p className={clinicStyles.notice} style={{ marginBottom: 0 }}>
            How the exercises in this block are actually meant to be performed. Straight sets shows no badge to
            the client; anything else shows as a badge at the top of this block, plus a side indicator for the
            two unilateral options.
          </p>
        </div>

        <div className={styles.controlCard}>
          <div className={styles.controlCardTitle}>Indication</div>
          <textarea
            className={styles.bigTextarea}
            value={conditionUseCase}
            onChange={(e) => setConditionUseCase(e.target.value)}
            placeholder="When this block is the right choice."
          />
        </div>

        <div className={styles.controlCard}>
          <div className={styles.controlCardTitle}>Contraindications</div>
          <textarea
            className={styles.bigTextarea}
            value={contraindicationFlags}
            onChange={(e) => setContraindicationFlags(e.target.value)}
            placeholder="When to avoid or adapt this block."
          />
        </div>

        {error && <div className={clinicStyles.error}>{error}</div>}

        <button
          type="button"
          className={clinicStyles.button}
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
          </>
  );

  return (
    <BuilderShell
      library={libraryPane}
      libraryTitle="Exercise library"
      centre={centrePane}
      controls={controlsPane}
    />
  );
}
