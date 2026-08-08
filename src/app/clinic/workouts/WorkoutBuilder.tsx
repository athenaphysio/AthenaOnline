"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clinicStyles from "../clinic.module.css";
import { useUnsavedChanges } from "../useUnsavedChanges";
import PickerCanvas, { PickerThumb, PickerResultBody } from "../builder/PickerCanvas";
import BlockGroupEditor, { type BlockDetail } from "../builder/BlockGroupEditor";
import CardioBlockEditor from "../builder/CardioBlockEditor";
import type { EditorItem } from "@/lib/blockItemsEditor";
import { SLOT_TYPES, slotTypeLabel, type SlotType } from "@/lib/slotTypes";
import {
  CARDIO_MODALITIES,
  CARDIO_STRUCTURES,
  cardioGroupLabel,
  cardioModalityLabel,
  newCardioBlockDetail,
  type CardioBlockDetail,
  type CardioCategory,
  type CardioModality,
  type CardioStructure,
  type CardioTier,
} from "@/lib/cardioBlock";
import styles from "./WorkoutBuilder.module.css";

// Mirrors RankContext in src/lib/rankLibrary.ts, redeclared here since that
// module is server-only and can't be imported into a client component.
type WorkoutContext = { focus: string; equipment: string; experienceLevel: string; tags: string[] };
type RankPick = { id: string; reason: string };

export type WorkoutItem = {
  key: string;
  slot_type: SlotType;
  block_id: string | null;
  block_name: string | null;
  exercise_id: string | null;
  exercise_name: string | null;
  cardio_block_id: string | null;
  cardio_block_name: string | null;
  /** Per-drop modality override -- lets a clinician change modality for
   * this one use without touching the shared template's own default.
   * Null means "use the template's default modality." */
  cardio_modality_override: CardioModality | null;
  cardio_modality_other_override: string | null;
  sets: number | null;
  reps: number | null;
  hold_seconds: number | null;
  percent_max: number | null;
  frequency: string | null;
  rationale: string | null;
};

export type BlockOption = { id: string; name: string; type: SlotType; block_length_weeks: number };
export type ExerciseOption = {
  exercise_id: string;
  name_clinical: string;
  body_site: string | null;
  thumbnail_url: string | null;
};
export type CardioOption = {
  id: string;
  name: string;
  modality: CardioModality;
  modality_other: string | null;
  structure: CardioStructure;
  category: CardioCategory;
  entry_criteria: string | null;
  tier: CardioTier | null;
};

type Props = {
  mode: "create" | "edit";
  workoutId: string;
  initialName: string;
  /** A manual, clinician-set flag marking this a genuinely high-load day
   * (heavy strength, hard intervals) -- never computed from percent_max or
   * cardio intensity, since judging which days are truly hard stays the
   * clinician's call. Powers the gentle back-to-back prompt on the weekly
   * calendar, never a rule the app enforces. */
  initialHighLoad?: boolean;
  initialItems: WorkoutItem[];
  exerciseLibrary: ExerciseOption[];
  /** Every block referenced by initialItems, with its own exercises and
   * per-week prescriptions -- lets a block-sourced item expand inline
   * instead of being an opaque reference. Keyed by block_id. */
  initialBlockDetails: Record<string, BlockDetail>;
  /** Every cardio block referenced by initialItems, full detail -- same
   * role as initialBlockDetails, keyed by cardio_block_id. */
  initialCardioBlockDetails: Record<string, CardioBlockDetail>;
  /** Default block_length_weeks for a block created via "+ New block" here.
   * The Programme Builder passes the programme's own block length; the
   * standalone Workout Builder page falls back to a sensible constant. */
  defaultBlockLengthWeeks: number;
  /** Called after a successful save with the (possibly renamed) workout
   * name and its current high_load flag -- lets a host that caches this
   * workout's own state elsewhere (the Programme Builder's calendar cell)
   * stay in sync without a reload. */
  onSaved?: (name: string, highLoad: boolean) => void;
};

let keyCounter = 0;
function newKey(): string {
  keyCounter += 1;
  return `new-${Date.now()}-${keyCounter}`;
}

type PickerTab = "blocks" | "exercises" | "cardio";

export default function WorkoutBuilder({
  mode,
  workoutId,
  initialName,
  initialHighLoad = false,
  initialItems,
  exerciseLibrary,
  initialBlockDetails,
  initialCardioBlockDetails,
  defaultBlockLengthWeeks,
  onSaved,
}: Props) {
  const [name, setName] = useState(initialName);
  const [highLoad, setHighLoad] = useState(initialHighLoad);
  const [items, setItems] = useState<WorkoutItem[]>(initialItems);
  const [blockDetailsByBlockId, setBlockDetailsByBlockId] = useState<Record<string, BlockDetail>>(initialBlockDetails);
  const [cardioDetailsByCardioId, setCardioDetailsByCardioId] =
    useState<Record<string, CardioBlockDetail>>(initialCardioBlockDetails);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { markSaved } = useUnsavedChanges({ name, highLoad, items, blockDetailsByBlockId, cardioDetailsByCardioId });

  const [pickerTab, setPickerTab] = useState<PickerTab>("blocks");
  const [blockQuery, setBlockQuery] = useState("");
  const [blockTypeFilter, setBlockTypeFilter] = useState("");
  const [blockResults, setBlockResults] = useState<BlockOption[]>([]);
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [cardioQuery, setCardioQuery] = useState("");
  const [cardioFilter, setCardioFilter] = useState("");
  const [cardioResults, setCardioResults] = useState<CardioOption[]>([]);

  const [showNewBlockForm, setShowNewBlockForm] = useState(false);
  const [newBlockName, setNewBlockName] = useState("");
  const [newBlockType, setNewBlockType] = useState<SlotType>("warm_up");
  const [newBlockLength, setNewBlockLength] = useState(defaultBlockLengthWeeks);
  const [creatingBlock, setCreatingBlock] = useState(false);
  const [newBlockError, setNewBlockError] = useState<string | null>(null);

  const [showNewCardioForm, setShowNewCardioForm] = useState(false);
  const [newCardioName, setNewCardioName] = useState("");
  const [newCardioModality, setNewCardioModality] = useState<CardioModality>("running");
  const [newCardioModalityOther, setNewCardioModalityOther] = useState("");
  const [newCardioStructure, setNewCardioStructure] = useState<CardioStructure>("steady_state");
  const [newCardioCategory, setNewCardioCategory] = useState<CardioCategory>("general");
  const [creatingCardio, setCreatingCardio] = useState(false);
  const [newCardioError, setNewCardioError] = useState<string | null>(null);

  // `ok: false` means the rank call itself failed (network/AI error) --
  // that degrades silently to the plain full library. `ok: true` with an
  // empty `picks` means ranking genuinely ran and found nothing worth
  // surfacing, which gets a plain "no good match" note instead of silence.
  type RankResult = { picks: RankPick[]; ok: boolean };

  const [workoutContext, setWorkoutContext] = useState<WorkoutContext | null>(null);
  const [blockRankCache, setBlockRankCache] = useState<Record<string, RankResult>>({});
  const [exerciseRankResult, setExerciseRankResult] = useState<RankResult | null>(null);
  const [rankingBlocks, setRankingBlocks] = useState(false);
  const [rankingExercises, setRankingExercises] = useState(false);
  const fetchedBlockTypes = useRef(new Set<string>());
  const fetchedExercisesOnce = useRef(false);

  // Fire-and-forget: log what was actually picked, with the brief context
  // active at the time, so ranking can get sharper at surfacing this later.
  // Never blocks the add, never surfaces an error if logging fails.
  function recordSelection(pool: "exercises" | "blocks", itemId: string, slotType?: SlotType) {
    if (!workoutContext) return;
    fetch("/api/clinic/picker-selections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pool, item_id: itemId, slot_type: slotType, context: workoutContext }),
    }).catch(() => {});
  }

  useEffect(() => {
    if (pickerTab !== "blocks") return;
    const handle = setTimeout(async () => {
      const params = new URLSearchParams();
      if (blockQuery) params.set("q", blockQuery);
      if (blockTypeFilter) params.set("type", blockTypeFilter);
      const res = await fetch(`/api/clinic/blocks/search?${params.toString()}`);
      const data = await res.json();
      setBlockResults(data.blocks ?? []);
    }, 250);
    return () => clearTimeout(handle);
  }, [blockQuery, blockTypeFilter, pickerTab]);

  useEffect(() => {
    if (pickerTab !== "cardio") return;
    const handle = setTimeout(async () => {
      const params = new URLSearchParams();
      if (cardioQuery) params.set("q", cardioQuery);
      if (cardioFilter) params.set("filter", cardioFilter);
      const res = await fetch(`/api/clinic/cardio-blocks/search?${params.toString()}`);
      const data = await res.json();
      setCardioResults(data.cardioBlocks ?? []);
    }, 250);
    return () => clearTimeout(handle);
  }, [cardioQuery, cardioFilter, pickerTab]);

  const exerciseResults = useMemo(() => {
    const q = exerciseQuery.trim().toLowerCase();
    return exerciseLibrary
      .filter((e) => (q ? e.name_clinical.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name_clinical.localeCompare(b.name_clinical))
      .slice(0, 40);
  }, [exerciseLibrary, exerciseQuery]);

  // Pick up the clinical context left by the scaffold generator (if this
  // workout was created from one), scoped by workout id via localStorage --
  // never via a URL param, and never containing raw brief text or PII.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`athena_workout_context:${workoutId}`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setWorkoutContext({
        focus: parsed.focus ?? "",
        equipment: parsed.equipment ?? "",
        experienceLevel: parsed.experienceLevel ?? "",
        tags: parsed.tags ?? [],
      });
    } catch {
      // No context available -- the picker just shows its normal full list.
    }
  }, [workoutId]);

  // Rank the block library for the active slot-type filter only -- ranking
  // is scoped per slot type, not one giant list, and only fires once per
  // type per session (cached) so switching filters back and forth is free.
  useEffect(() => {
    if (pickerTab !== "blocks" || !blockTypeFilter || !workoutContext) return;
    if (fetchedBlockTypes.current.has(blockTypeFilter)) return;
    fetchedBlockTypes.current.add(blockTypeFilter);
    setRankingBlocks(true);
    fetch("/api/clinic/rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pool: "blocks", slot_type: blockTypeFilter, context: workoutContext }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ranking failed.");
        return data;
      })
      .then((data) =>
        setBlockRankCache((prev) => ({ ...prev, [blockTypeFilter]: { picks: data.picks ?? [], ok: true } }))
      )
      .catch(() => setBlockRankCache((prev) => ({ ...prev, [blockTypeFilter]: { picks: [], ok: false } })))
      .finally(() => setRankingBlocks(false));
  }, [pickerTab, blockTypeFilter, workoutContext]);

  // Standalone exercises aren't slot-typed, so this ranks against the whole
  // context once and is reused for as long as the tab stays open.
  useEffect(() => {
    if (pickerTab !== "exercises" || !workoutContext) return;
    if (fetchedExercisesOnce.current) return;
    fetchedExercisesOnce.current = true;
    setRankingExercises(true);
    fetch("/api/clinic/rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pool: "exercises", context: workoutContext }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ranking failed.");
        return data;
      })
      .then((data) => setExerciseRankResult({ picks: data.picks ?? [], ok: true }))
      .catch(() => setExerciseRankResult({ picks: [], ok: false }))
      .finally(() => setRankingExercises(false));
  }, [pickerTab, workoutContext]);

  const blockTopPicks = useMemo(() => {
    if (!blockTypeFilter) return undefined;
    const result = blockRankCache[blockTypeFilter];
    if (!result || !result.ok) return undefined;
    const byId = new Map(blockResults.map((b) => [b.id, b]));
    return result.picks
      .map((p) => ({ item: byId.get(p.id), reason: p.reason }))
      .filter((p): p is { item: BlockOption; reason: string } => Boolean(p.item));
  }, [blockTypeFilter, blockRankCache, blockResults]);

  const exerciseTopPicks = useMemo(() => {
    if (!exerciseRankResult || !exerciseRankResult.ok) return undefined;
    const byId = new Map(exerciseLibrary.map((e) => [e.exercise_id, e]));
    return exerciseRankResult.picks
      .map((p) => ({ item: byId.get(p.id), reason: p.reason }))
      .filter((p): p is { item: ExerciseOption; reason: string } => Boolean(p.item));
  }, [exerciseRankResult, exerciseLibrary]);

  function addBlock(block: BlockOption) {
    setItems((prev) => [
      ...prev,
      {
        key: newKey(),
        slot_type: block.type,
        block_id: block.id,
        block_name: block.name,
        exercise_id: null,
        exercise_name: null,
        cardio_block_id: null,
        cardio_block_name: null,
        cardio_modality_override: null,
        cardio_modality_other_override: null,
        sets: null,
        reps: null,
        hold_seconds: null,
        percent_max: null,
        frequency: null,
        rationale: null,
      },
    ]);
    recordSelection("blocks", block.id, block.type);

    // Fetch this block's own exercises/prescriptions so it can expand
    // inline rather than sitting as an opaque reference -- skipped if
    // already known (e.g. the same block added a second time).
    if (!blockDetailsByBlockId[block.id]) {
      fetch(`/api/clinic/blocks/${block.id}`)
        .then((res) => res.json())
        .then((data: BlockDetail) => {
          setBlockDetailsByBlockId((prev) => (prev[block.id] ? prev : { ...prev, [block.id]: data }));
        })
        .catch(() => {
          // Best-effort -- if this fails the item still shows as a plain
          // row; the clinician can still edit the block via its own page.
        });
    }
  }

  function updateBlockItems(blockId: string, newItems: EditorItem[]) {
    setBlockDetailsByBlockId((prev) => {
      const existing = prev[blockId];
      if (!existing) return prev;
      return { ...prev, [blockId]: { ...existing, items: newItems } };
    });
  }

  async function createBlock() {
    if (!newBlockName.trim()) return;
    setCreatingBlock(true);
    setNewBlockError(null);
    try {
      const id = crypto.randomUUID();
      const res = await fetch("/api/clinic/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name: newBlockName.trim(),
          type: newBlockType,
          block_length_weeks: newBlockLength,
          items: [],
          ai_draft: null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't create block.");

      const detail: BlockDetail = { id, name: newBlockName.trim(), type: newBlockType, block_length_weeks: newBlockLength, items: [] };
      setBlockDetailsByBlockId((prev) => ({ ...prev, [id]: detail }));
      setItems((prev) => [
        ...prev,
        {
          key: newKey(),
          slot_type: newBlockType,
          block_id: id,
          block_name: detail.name,
          exercise_id: null,
          exercise_name: null,
          cardio_block_id: null,
          cardio_block_name: null,
          cardio_modality_override: null,
          cardio_modality_other_override: null,
          sets: null,
          reps: null,
          hold_seconds: null,
          percent_max: null,
          frequency: null,
          rationale: null,
        },
      ]);
      setNewBlockName("");
      setShowNewBlockForm(false);
    } catch (err) {
      setNewBlockError(err instanceof Error ? err.message : "Couldn't create block.");
    } finally {
      setCreatingBlock(false);
    }
  }

  function addExercise(exercise: ExerciseOption) {
    setItems((prev) => [
      ...prev,
      {
        key: newKey(),
        slot_type: "main_body",
        block_id: null,
        block_name: null,
        exercise_id: exercise.exercise_id,
        exercise_name: exercise.name_clinical,
        cardio_block_id: null,
        cardio_block_name: null,
        cardio_modality_override: null,
        cardio_modality_other_override: null,
        sets: null,
        reps: null,
        hold_seconds: null,
        percent_max: null,
        frequency: null,
        rationale: null,
      },
    ]);
    recordSelection("exercises", exercise.exercise_id, "main_body");
  }

  function addCardio(cardio: CardioOption) {
    setItems((prev) => [
      ...prev,
      {
        key: newKey(),
        slot_type: "main_body",
        block_id: null,
        block_name: null,
        exercise_id: null,
        exercise_name: null,
        cardio_block_id: cardio.id,
        cardio_block_name: cardio.name,
        cardio_modality_override: cardio.modality,
        cardio_modality_other_override: cardio.modality_other,
        sets: null,
        reps: null,
        hold_seconds: null,
        percent_max: null,
        frequency: null,
        rationale: null,
      },
    ]);

    // Fetch this cardio block's own detail so it can expand inline rather
    // than sitting as an opaque reference -- skipped if already known
    // (e.g. the same cardio block added a second time).
    if (!cardioDetailsByCardioId[cardio.id]) {
      fetch(`/api/clinic/cardio-blocks/${cardio.id}`)
        .then((res) => res.json())
        .then((data: CardioBlockDetail) => {
          setCardioDetailsByCardioId((prev) => (prev[cardio.id] ? prev : { ...prev, [cardio.id]: data }));
        })
        .catch(() => {
          // Best-effort -- if this fails the item still shows as a plain row.
        });
    }
  }

  function updateCardioBlock(cardioId: string, patch: Partial<CardioBlockDetail>) {
    setCardioDetailsByCardioId((prev) => {
      const existing = prev[cardioId];
      if (!existing) return prev;
      return { ...prev, [cardioId]: { ...existing, ...patch } };
    });
  }

  async function createCardioBlock() {
    if (!newCardioName.trim()) return;
    setCreatingCardio(true);
    setNewCardioError(null);
    try {
      const id = crypto.randomUUID();
      const res = await fetch("/api/clinic/cardio-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name: newCardioName.trim(),
          modality: newCardioModality,
          modality_other: newCardioModality === "other" ? newCardioModalityOther.trim() || null : null,
          structure: newCardioStructure,
          category: newCardioCategory,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't create cardio block.");

      const detail = newCardioBlockDetail(id, newCardioName.trim(), newCardioModality, newCardioStructure, newCardioCategory);
      if (newCardioModality === "other") detail.modality_other = newCardioModalityOther.trim() || null;
      setCardioDetailsByCardioId((prev) => ({ ...prev, [id]: detail }));
      setItems((prev) => [
        ...prev,
        {
          key: newKey(),
          slot_type: "main_body",
          block_id: null,
          block_name: null,
          exercise_id: null,
          exercise_name: null,
          cardio_block_id: id,
          cardio_block_name: detail.name,
          cardio_modality_override: detail.modality,
          cardio_modality_other_override: detail.modality_other,
          sets: null,
          reps: null,
          hold_seconds: null,
          percent_max: null,
          frequency: null,
          rationale: null,
        },
      ]);
      setNewCardioName("");
      setNewCardioModalityOther("");
      setNewCardioCategory("general");
      setShowNewCardioForm(false);
    } catch (err) {
      setNewCardioError(err instanceof Error ? err.message : "Couldn't create cardio block.");
    } finally {
      setCreatingCardio(false);
    }
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

  function updateItem(key: string, patch: Partial<WorkoutItem>) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        id: workoutId,
        name,
        high_load: highLoad,
        items: items.map((item, i) => ({
          item_order: i + 1,
          slot_type: item.slot_type,
          block_id: item.block_id,
          exercise_id: item.exercise_id,
          cardio_block_id: item.cardio_block_id,
          cardio_modality_override: item.cardio_modality_override,
          cardio_modality_other_override: item.cardio_modality_other_override,
          sets: item.sets,
          reps: item.reps,
          hold_seconds: item.hold_seconds,
          percent_max: item.percent_max,
          frequency: item.frequency,
          rationale: item.rationale,
        })),
      };

      const res = await fetch(mode === "create" ? "/api/clinic/workouts" : `/api/clinic/workouts/${workoutId}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");

      // Every block referenced by this workout saves alongside it -- one
      // Save button, everything persists together. A block only shows up
      // here once it's been added or created inline (see addBlock/createBlock).
      const referencedBlockIds = new Set(items.map((i) => i.block_id).filter((v): v is string => Boolean(v)));
      await Promise.all(
        Array.from(referencedBlockIds).map(async (blockId) => {
          const block = blockDetailsByBlockId[blockId];
          if (!block) return;
          const blockRes = await fetch(`/api/clinic/blocks/${blockId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: block.name,
              type: block.type,
              block_length_weeks: block.block_length_weeks,
              items: block.items.map((item, i) => ({
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
            }),
          });
          if (!blockRes.ok) {
            const blockData = await blockRes.json().catch(() => ({}));
            throw new Error(blockData.error || `Couldn't save "${block.name}".`);
          }
        })
      );

      // Same one-Save pattern for every cardio block this workout references.
      const referencedCardioIds = new Set(items.map((i) => i.cardio_block_id).filter((v): v is string => Boolean(v)));
      await Promise.all(
        Array.from(referencedCardioIds).map(async (cardioId) => {
          const cardio = cardioDetailsByCardioId[cardioId];
          if (!cardio) return;
          const cardioRes = await fetch(`/api/clinic/cardio-blocks/${cardioId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(cardio),
          });
          if (!cardioRes.ok) {
            const cardioData = await cardioRes.json().catch(() => ({}));
            throw new Error(cardioData.error || `Couldn't save "${cardio.name}".`);
          }
        })
      );

      setSaved(true);
      markSaved({ name, highLoad, items, blockDetailsByBlockId, cardioDetailsByCardioId });
      onSaved?.(name, highLoad);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* A light card, not a bare field on the canvas -- see the matching
          comment in BlockBuilder.tsx. */}
      <div className={clinicStyles.card}>
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Workout name</label>
          <input className={clinicStyles.input} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--graphite)" }}>
          <input type="checkbox" checked={highLoad} onChange={(e) => setHighLoad(e.target.checked)} />
          High-load day (heavy strength, or a hard interval run). Powers a gentle prompt if two of these land back to
          back on a patient&apos;s weekly schedule; never enforced.
        </label>
      </div>

      <div className={styles.pickerTabs}>
        <button
          type="button"
          className={`${styles.pickerTab} ${pickerTab === "blocks" ? styles.pickerTabActive : ""}`}
          onClick={() => setPickerTab("blocks")}
        >
          Blocks
        </button>
        <button
          type="button"
          className={`${styles.pickerTab} ${pickerTab === "exercises" ? styles.pickerTabActive : ""}`}
          onClick={() => setPickerTab("exercises")}
        >
          + Add a standalone exercise
        </button>
        <button
          type="button"
          className={`${styles.pickerTab} ${pickerTab === "cardio" ? styles.pickerTabActive : ""}`}
          onClick={() => setPickerTab("cardio")}
        >
          Cardio
        </button>
        <button
          type="button"
          className={`${styles.pickerTab} ${showNewBlockForm ? styles.pickerTabActive : ""}`}
          onClick={() => setShowNewBlockForm((v) => !v)}
        >
          + New block
        </button>
        <button
          type="button"
          className={`${styles.pickerTab} ${showNewCardioForm ? styles.pickerTabActive : ""}`}
          onClick={() => setShowNewCardioForm((v) => !v)}
        >
          + New cardio block
        </button>
      </div>

      {showNewBlockForm && (
        <div className={clinicStyles.card} style={{ marginBottom: 16 }}>
          <div className={clinicStyles.cardTitle}>New block</div>
          <div className={clinicStyles.row2}>
            <div className={clinicStyles.field}>
              <label className={clinicStyles.label}>Name</label>
              <input
                className={clinicStyles.input}
                value={newBlockName}
                onChange={(e) => setNewBlockName(e.target.value)}
              />
            </div>
            <div className={clinicStyles.field}>
              <label className={clinicStyles.label}>Type</label>
              <select
                className={clinicStyles.input}
                value={newBlockType}
                onChange={(e) => setNewBlockType(e.target.value as SlotType)}
              >
                {SLOT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={clinicStyles.field}>
            <label className={clinicStyles.label}>Length (weeks)</label>
            <input
              type="number"
              min={1}
              max={12}
              className={clinicStyles.input}
              style={{ maxWidth: 160 }}
              value={newBlockLength}
              onChange={(e) => setNewBlockLength(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
            />
          </div>
          {newBlockError && <div className={clinicStyles.error}>{newBlockError}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className={clinicStyles.button}
              style={{ width: "auto", padding: "0 20px" }}
              disabled={creatingBlock || !newBlockName.trim()}
              onClick={createBlock}
            >
              {creatingBlock ? "Creating…" : "Create block"}
            </button>
            <button
              type="button"
              className={clinicStyles.buttonSecondary}
              style={{ width: "auto", padding: "0 20px" }}
              onClick={() => setShowNewBlockForm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showNewCardioForm && (
        <div className={clinicStyles.card} style={{ marginBottom: 16 }}>
          <div className={clinicStyles.cardTitle}>New cardio block</div>
          <div className={clinicStyles.row2}>
            <div className={clinicStyles.field}>
              <label className={clinicStyles.label}>Name</label>
              <input
                className={clinicStyles.input}
                value={newCardioName}
                onChange={(e) => setNewCardioName(e.target.value)}
                placeholder="e.g. 5x1min run intervals, moderate"
              />
            </div>
            <div className={clinicStyles.field}>
              <label className={clinicStyles.label}>Modality</label>
              <select
                className={clinicStyles.input}
                value={newCardioModality}
                onChange={(e) => setNewCardioModality(e.target.value as CardioModality)}
              >
                {CARDIO_MODALITIES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {newCardioModality === "other" && (
            <div className={clinicStyles.field}>
              <label className={clinicStyles.label}>Which modality</label>
              <input
                className={clinicStyles.input}
                value={newCardioModalityOther}
                onChange={(e) => setNewCardioModalityOther(e.target.value)}
              />
            </div>
          )}
          <div className={clinicStyles.row2}>
            <div className={clinicStyles.field}>
              <label className={clinicStyles.label}>Structure</label>
              <select
                className={clinicStyles.input}
                value={newCardioStructure}
                onChange={(e) => setNewCardioStructure(e.target.value as CardioStructure)}
              >
                {CARDIO_STRUCTURES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={clinicStyles.field}>
              <label className={clinicStyles.label}>Category</label>
              <select
                className={clinicStyles.input}
                value={newCardioCategory}
                onChange={(e) => setNewCardioCategory(e.target.value as CardioCategory)}
              >
                <option value="general">General</option>
                <option value="return_to_run">Return to Run</option>
                <option value="running_progression">Running Progression</option>
              </select>
            </div>
          </div>
          {newCardioError && <div className={clinicStyles.error}>{newCardioError}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className={clinicStyles.button}
              style={{ width: "auto", padding: "0 20px" }}
              disabled={creatingCardio || !newCardioName.trim()}
              onClick={createCardioBlock}
            >
              {creatingCardio ? "Creating…" : "Create cardio block"}
            </button>
            <button
              type="button"
              className={clinicStyles.buttonSecondary}
              style={{ width: "auto", padding: "0 20px" }}
              onClick={() => setShowNewCardioForm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {pickerTab === "blocks" ? (
        <PickerCanvas<BlockOption, WorkoutItem>
          pickerTitle="Block library"
          searchQuery={blockQuery}
          onSearchChange={setBlockQuery}
          searchPlaceholder="Search blocks…"
          filters={SLOT_TYPES}
          activeFilter={blockTypeFilter}
          onFilterChange={setBlockTypeFilter}
          pickerItems={blockResults}
          getPickerItemKey={(b) => b.id}
          renderPickerItem={(b) => (
            <>
              <PickerThumb src={null} label={b.name} />
              <PickerResultBody name={b.name} tags={[slotTypeLabel(b.type), `${b.block_length_weeks}wk`]} />
            </>
          )}
          isAdded={(b) => items.some((i) => i.block_id === b.id)}
          onAdd={addBlock}
          pickerEmptyMessage="No blocks match. Build one in the Blocks library first."
          topPicks={blockTopPicks}
          topPicksTitle={blockTypeFilter ? `Suggested ${slotTypeLabel(blockTypeFilter).toLowerCase()} blocks` : undefined}
          topPicksLoading={rankingBlocks}
          topPicksEmptyMessage={
            blockTypeFilter
              ? `Nothing in your ${slotTypeLabel(blockTypeFilter).toLowerCase()} blocks scores highly for this — here's the full list.`
              : undefined
          }
          canvasTitle={`This workout (${items.length} item${items.length === 1 ? "" : "s"})`}
          canvasItems={items}
          getCanvasItemKey={(item) => item.key}
          renderCanvasItem={(item) => (
            <div className={styles.rowMeta}>
              <span>{item.block_name ?? item.cardio_block_name ?? item.exercise_name}</span>
              <span className={styles.sourceTag}>{sourceTag(item)}</span>
            </div>
          )}
          onMoveUp={(i) => moveItem(i, -1)}
          onMoveDown={(i) => moveItem(i, 1)}
          onRemove={removeItem}
          canvasEmptyMessage="Add blocks, cardio, or a standalone exercise from the left."
          groupCanvasBy={(item) => slotTypeLabel(item.slot_type)}
          groupOrder={SLOT_TYPES.map((t) => t.label)}
          canvasRowExtra={(item) => (
            <ItemExtra
              item={item}
              onChange={(patch) => updateItem(item.key, patch)}
              blockDetail={item.block_id ? blockDetailsByBlockId[item.block_id] : undefined}
              exerciseLibrary={exerciseLibrary}
              onChangeBlockItems={item.block_id ? (newItems) => updateBlockItems(item.block_id!, newItems) : undefined}
              cardioDetail={item.cardio_block_id ? cardioDetailsByCardioId[item.cardio_block_id] : undefined}
              onChangeCardio={item.cardio_block_id ? (patch) => updateCardioBlock(item.cardio_block_id!, patch) : undefined}
            />
          )}
        />
      ) : pickerTab === "exercises" ? (
        <PickerCanvas<ExerciseOption, WorkoutItem>
          pickerTitle="Exercise library"
          searchQuery={exerciseQuery}
          onSearchChange={setExerciseQuery}
          searchPlaceholder="Search exercises…"
          pickerItems={exerciseResults}
          getPickerItemKey={(e) => e.exercise_id}
          renderPickerItem={(e) => (
            <>
              <PickerThumb src={e.thumbnail_url} label={e.name_clinical} />
              <PickerResultBody name={e.name_clinical} tags={[e.body_site]} />
            </>
          )}
          isAdded={(e) => items.some((i) => i.exercise_id === e.exercise_id)}
          onAdd={addExercise}
          pickerEmptyMessage="No exercises match."
          topPicks={exerciseTopPicks}
          topPicksLoading={rankingExercises}
          canvasTitle={`This workout (${items.length} item${items.length === 1 ? "" : "s"})`}
          canvasItems={items}
          getCanvasItemKey={(item) => item.key}
          renderCanvasItem={(item) => (
            <div className={styles.rowMeta}>
              <span>{item.block_name ?? item.cardio_block_name ?? item.exercise_name}</span>
              <span className={styles.sourceTag}>{sourceTag(item)}</span>
            </div>
          )}
          onMoveUp={(i) => moveItem(i, -1)}
          onMoveDown={(i) => moveItem(i, 1)}
          onRemove={removeItem}
          canvasEmptyMessage="Add blocks, cardio, or a standalone exercise from the left."
          groupCanvasBy={(item) => slotTypeLabel(item.slot_type)}
          groupOrder={SLOT_TYPES.map((t) => t.label)}
          canvasRowExtra={(item) => (
            <ItemExtra
              item={item}
              onChange={(patch) => updateItem(item.key, patch)}
              blockDetail={item.block_id ? blockDetailsByBlockId[item.block_id] : undefined}
              exerciseLibrary={exerciseLibrary}
              onChangeBlockItems={item.block_id ? (newItems) => updateBlockItems(item.block_id!, newItems) : undefined}
              cardioDetail={item.cardio_block_id ? cardioDetailsByCardioId[item.cardio_block_id] : undefined}
              onChangeCardio={item.cardio_block_id ? (patch) => updateCardioBlock(item.cardio_block_id!, patch) : undefined}
            />
          )}
        />
      ) : (
        <PickerCanvas<CardioOption, WorkoutItem>
          pickerTitle="Cardio block library"
          searchQuery={cardioQuery}
          onSearchChange={setCardioQuery}
          searchPlaceholder="Search cardio blocks…"
          filters={[
            { value: "steady_state", label: "Steady-state" },
            { value: "intervals", label: "Intervals" },
            { value: "return_to_run", label: "Return to Run" },
            { value: "running_progression", label: "Running Progression" },
          ]}
          activeFilter={cardioFilter}
          onFilterChange={setCardioFilter}
          pickerItems={cardioResults}
          getPickerItemKey={(c) => c.id}
          renderPickerItem={(c) => (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <PickerThumb src={null} label={c.name} />
                <PickerResultBody name={c.name} tags={[cardioModalityLabel(c.modality, c.modality_other), cardioGroupLabel(c)]} />
              </div>
              {/* Shown before adding, per the request that this reads as a
                  reminder for David to confirm, not something the picker
                  itself gatekeeps. */}
              {c.category === "return_to_run" && c.entry_criteria && (
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--graphite)",
                    marginTop: 6,
                    lineHeight: 1.4,
                    background: "var(--mist)",
                    borderRadius: 6,
                    padding: "6px 8px",
                  }}
                >
                  <strong>Entry criteria:</strong> {c.entry_criteria}
                </div>
              )}
            </div>
          )}
          isAdded={(c) => items.some((i) => i.cardio_block_id === c.id)}
          onAdd={addCardio}
          pickerEmptyMessage="No cardio blocks match. Create one above."
          canvasTitle={`This workout (${items.length} item${items.length === 1 ? "" : "s"})`}
          canvasItems={items}
          getCanvasItemKey={(item) => item.key}
          renderCanvasItem={(item) => (
            <div className={styles.rowMeta}>
              <span>{item.block_name ?? item.cardio_block_name ?? item.exercise_name}</span>
              <span className={styles.sourceTag}>{sourceTag(item)}</span>
            </div>
          )}
          onMoveUp={(i) => moveItem(i, -1)}
          onMoveDown={(i) => moveItem(i, 1)}
          onRemove={removeItem}
          canvasEmptyMessage="Add blocks, cardio, or a standalone exercise from the left."
          groupCanvasBy={(item) => slotTypeLabel(item.slot_type)}
          groupOrder={SLOT_TYPES.map((t) => t.label)}
          canvasRowExtra={(item) => (
            <ItemExtra
              item={item}
              onChange={(patch) => updateItem(item.key, patch)}
              blockDetail={item.block_id ? blockDetailsByBlockId[item.block_id] : undefined}
              exerciseLibrary={exerciseLibrary}
              onChangeBlockItems={item.block_id ? (newItems) => updateBlockItems(item.block_id!, newItems) : undefined}
              cardioDetail={item.cardio_block_id ? cardioDetailsByCardioId[item.cardio_block_id] : undefined}
              onChangeCardio={item.cardio_block_id ? (patch) => updateCardioBlock(item.cardio_block_id!, patch) : undefined}
            />
          )}
        />
      )}

      {error && (
        <div className={clinicStyles.error} style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      <button
        type="button"
        className={clinicStyles.button}
        style={{ marginTop: 20 }}
        disabled={saving || !name.trim() || items.length === 0}
        onClick={handleSubmit}
      >
        {saving ? "Saving…" : saved ? "Save changes" : "Save workout"}
      </button>

      {saved && (
        <div className={clinicStyles.shareLinkCard}>
          <div className={clinicStyles.smallLabel}>Saved</div>
          <div className={clinicStyles.shareLinkText}>
            &ldquo;{name}&rdquo; is in your Workout library, ready to schedule into a Programme.
          </div>
        </div>
      )}
    </div>
  );
}

function sourceTag(item: WorkoutItem): string {
  if (item.block_id) return "Block";
  if (item.cardio_block_id) return "Cardio";
  return "Standalone";
}

function ItemExtra({
  item,
  onChange,
  blockDetail,
  exerciseLibrary,
  onChangeBlockItems,
  cardioDetail,
  onChangeCardio,
}: {
  item: WorkoutItem;
  onChange: (patch: Partial<WorkoutItem>) => void;
  blockDetail?: BlockDetail;
  exerciseLibrary: ExerciseOption[];
  onChangeBlockItems?: (items: EditorItem[]) => void;
  cardioDetail?: CardioBlockDetail;
  onChangeCardio?: (patch: Partial<CardioBlockDetail>) => void;
}) {
  return (
    <div>
      <div className={styles.fieldLabel}>Slot type</div>
      <select
        className={styles.slotSelect}
        value={item.slot_type}
        onChange={(e) => onChange({ slot_type: e.target.value as SlotType })}
      >
        {SLOT_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      {item.exercise_id && (
        <div className={styles.fieldGrid}>
          <div>
            <div className={styles.fieldLabel}>Sets</div>
            <input
              type="number"
              className={styles.fieldInput}
              value={item.sets ?? ""}
              onChange={(e) => onChange({ sets: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </div>
          <div>
            <div className={styles.fieldLabel}>Reps</div>
            <input
              type="number"
              className={styles.fieldInput}
              value={item.reps ?? ""}
              onChange={(e) => onChange({ reps: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </div>
          <div>
            <div className={styles.fieldLabel}>Hold (s)</div>
            <input
              type="number"
              className={styles.fieldInput}
              value={item.hold_seconds ?? ""}
              onChange={(e) => onChange({ hold_seconds: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </div>
          <div>
            <div className={styles.fieldLabel}>% max</div>
            <input
              type="number"
              className={styles.fieldInput}
              value={item.percent_max ?? ""}
              onChange={(e) => onChange({ percent_max: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </div>
          <div>
            <div className={styles.fieldLabel}>Frequency</div>
            <input
              className={styles.fieldInput}
              value={item.frequency ?? ""}
              onChange={(e) => onChange({ frequency: e.target.value || null })}
            />
          </div>
        </div>
      )}

      {item.block_id && blockDetail && onChangeBlockItems && (
        <BlockGroupEditor block={blockDetail} exerciseLibrary={exerciseLibrary} onChange={onChangeBlockItems} />
      )}
      {item.block_id && !blockDetail && (
        <div className={styles.fieldLabel} style={{ marginTop: 8 }}>
          Loading this block&apos;s exercises…
        </div>
      )}

      {item.cardio_block_id && cardioDetail && (
        <div className={styles.fieldGrid} style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <div className={styles.fieldLabel}>Modality for this patient</div>
            <select
              className={styles.slotSelect}
              value={item.cardio_modality_override ?? cardioDetail.modality}
              onChange={(e) =>
                onChange({ cardio_modality_override: e.target.value as CardioModality, cardio_modality_other_override: null })
              }
            >
              {CARDIO_MODALITIES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          {(item.cardio_modality_override ?? cardioDetail.modality) === "other" && (
            <div>
              <div className={styles.fieldLabel}>Which modality</div>
              <input
                className={styles.fieldInput}
                value={item.cardio_modality_other_override ?? ""}
                onChange={(e) => onChange({ cardio_modality_other_override: e.target.value || null })}
              />
            </div>
          )}
        </div>
      )}

      {item.cardio_block_id && cardioDetail && onChangeCardio && (
        <CardioBlockEditor cardio={cardioDetail} onChange={onChangeCardio} />
      )}
      {item.cardio_block_id && !cardioDetail && (
        <div className={styles.fieldLabel} style={{ marginTop: 8 }}>
          Loading this cardio block…
        </div>
      )}
    </div>
  );
}
