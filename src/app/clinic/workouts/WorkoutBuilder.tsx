"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../clinic.module.css";
import { useUnsavedChanges } from "../useUnsavedChanges";
import { PickerThumb, PickerResultBody } from "../builder/PickerCanvas";
import BuilderShell from "../builder/BuilderShell";
import DesignationPicker from "../builder/DesignationPicker";
import { useBuilderPalette } from "../BuilderPaletteContext";
import { pickerStateFor, newBlockTypeFor, WORKOUT_CONTENT_KEYS, type PickerTab } from "@/lib/builderPalette";
import DrillListToggle from "../builder/DrillListToggle";
import BlockGroupEditor, { type BlockDetail } from "../builder/BlockGroupEditor";
import CardioBlockEditor from "../builder/CardioBlockEditor";
import AudioRecorder from "../AudioRecorder";
import PatientPicker, { type Patient } from "../PatientPicker";
import type { EditorItem } from "@/lib/blockItemsEditor";
import { SLOT_TYPES, slotTypeLabel, type SlotType } from "@/lib/slotTypes";
import { categoryMeta, type BlockCategory } from "@/lib/blockCategory";
import { cleanDesignations, DESIGNATIONS, designationLabel, type Designation } from "@/lib/designations";
import { cleanWorkoutKind, workoutKindLabel, type WorkoutKind } from "@/lib/workoutKind";
import { PRESCRIPTION_DEFAULTS } from "@/lib/prescriptionDefaults";
import { cleanPrescriptionMode, fieldsForMode, type PrescriptionMode } from "@/lib/prescriptionMode";
import type { BlockUsageTag } from "@/lib/blockUsageTags";
import PrescriptionModeToggle from "../builder/PrescriptionModeToggle";
import { badgeForSequenceType, type SequenceType } from "@/lib/sequenceType";
import {
  CARDIO_MODALITIES,
  CARDIO_STRUCTURES,
  cardioGroupLabel,
  cardioModalityLabel,
  cardioPlainSummary,
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
  prescription_mode: PrescriptionMode;
  rationale: string | null;
};

export type BlockOption = {
  id: string;
  name: string;
  type: SlotType;
  block_length_weeks: number;
  designations: Designation[];
  usage_tag_ids: string[];
  drillNames: string[];
};
export type ExerciseOption = {
  exercise_id: string;
  name_clinical: string;
  body_site: string | null;
  thumbnail_url: string | null;
  default_prescription_mode?: string | null;
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
  initialDesignations?: string[];
  /** Which type of workout this is. Cardio workouts are built, listed and
   * found separately, and open on the cardio side of the library. */
  kind?: WorkoutKind;
  initialItems: WorkoutItem[];
  exerciseLibrary: ExerciseOption[];
  usageTagCatalog?: BlockUsageTag[];
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
  /** Hand the panes to the host instead of rendering the standard
   * BuilderShell, so a page that has its own layout (the Programme builder)
   * can place the library, the preview, the top bar and the bottom section
   * in its own page rather than a persistent rail. All state and behaviour
   * stay here; only placement moves. `topBar` carries just the name and
   * format fields. `bottomLead`/`bottomTail` are the two ends of what used
   * to live in the right-hand rail -- split in two rather than one block so
   * a host with its own bottom content (patient card, access window, etc.)
   * can sandwich it between them: high-load flag first, Save workout last,
   * same order as when nothing is sandwiched in between. */
  renderSlots?: (panes: {
    library: ReactNode;
    centre: ReactNode;
    topBar: ReactNode;
    bottomLead: ReactNode;
    bottomTail: ReactNode;
  }) => ReactNode;
  /** Drop the controls a host programme already owns -- access window,
   * programme message, programme notes and goal picture, intro line, and
   * the whole assign flow. Without this, embedding shows two of each
   * writing to two different pieces of state. */
  hideProgrammeControls?: boolean;
};

let keyCounter = 0;
function newKey(): string {
  keyCounter += 1;
  return `new-${Date.now()}-${keyCounter}`;
}

const DAY_LABELS: { value: number; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

export default function WorkoutBuilder({
  mode,
  workoutId,
  initialName,
  initialHighLoad = false,
  initialDesignations = [],
  kind = "standard",
  initialItems,
  exerciseLibrary,
  usageTagCatalog = [],
  initialBlockDetails,
  initialCardioBlockDetails,
  defaultBlockLengthWeeks,
  onSaved,
  renderSlots,
  hideProgrammeControls = false,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [highLoad, setHighLoad] = useState(initialHighLoad);
  const [designations, setDesignations] = useState<Designation[]>(() => cleanDesignations(initialDesignations));
  const [items, setItems] = useState<WorkoutItem[]>(initialItems);
  const [blockDetailsByBlockId, setBlockDetailsByBlockId] = useState<Record<string, BlockDetail>>(initialBlockDetails);
  const [cardioDetailsByCardioId, setCardioDetailsByCardioId] =
    useState<Record<string, CardioBlockDetail>>(initialCardioBlockDetails);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // ---- Right-panel draft fields -- none of this is persisted anywhere
  // until "Assign to client" actually creates a real Programme. A stable,
  // client-generated id from the start means the audio recorder and (once
  // a patient's chosen) the goal picture can both use the same real
  // storage path from their very first upload, with no rename step later.
  const [draftProgrammeId] = useState(() => crypto.randomUUID());
  const [accessWindowWeeks, setAccessWindowWeeks] = useState<number | null>(6);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [introLine, setIntroLine] = useState("");
  const [goalImageFile, setGoalImageFile] = useState<File | null>(null);
  const [goalImagePreviewUrl, setGoalImagePreviewUrl] = useState<string | null>(null);

  const { markSaved } = useUnsavedChanges({
    name,
    highLoad,
    designations,
    items,
    blockDetailsByBlockId,
    cardioDetailsByCardioId,
    accessWindowWeeks,
    audioUrl,
    notes,
    introLine,
  });

  // The far-left rail is the palette while this builder is open, so what
  // the library shows is owned by that shared state rather than by a second
  // copy here -- the rail's own tabs below write to the same place, so the
  // two can never disagree. Deliberately not part of useUnsavedChanges:
  // changing which content type you are browsing is not an edit.
  const palette = useBuilderPalette();
  const { setSupported } = palette;
  const { select: selectPalette } = palette;
  useEffect(() => {
    setSupported(WORKOUT_CONTENT_KEYS);
    // A cardio workout is built from cardio, so start there rather than
    // making David switch every time he opens one.
    if (kind === "cardio") selectPalette("cardio");
    return () => setSupported([]);
  }, [setSupported, selectPalette, kind]);

  // Derived, never copied into local state: the rail and the library's own
  // tabs write to the same palette, so there is no second source that can
  // drift or overwrite. A rail category that implies a block type wins;
  // otherwise the type dropdown's own narrower choice applies.
  const pickerTab = pickerStateFor(palette.selected).tab;
  const blockTypeFilter = pickerStateFor(palette.selected).blockType || palette.blockType;
  const setPickerTab = (tab: PickerTab) => palette.select(tab);

  const [blockQuery, setBlockQuery] = useState("");
  const [blockDesignation, setBlockDesignation] = useState("");
  const [blockUsageTagFilter, setBlockUsageTagFilter] = useState("");
  const usageTagsById = useMemo(() => new Map(usageTagCatalog.map((t) => [t.id, t.name])), [usageTagCatalog]);
  const [blockResults, setBlockResults] = useState<BlockOption[]>([]);
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [cardioQuery, setCardioQuery] = useState("");
  const [cardioFilter, setCardioFilter] = useState("");
  const [cardioResults, setCardioResults] = useState<CardioOption[]>([]);

  const [showNewBlockForm, setShowNewBlockForm] = useState(false);
  const [newBlockName, setNewBlockName] = useState("");
  // Null until David picks one by hand -- until then "+ New block" creates
  // whatever the palette is currently showing, so opening the form while
  // Activations is selected gives an activation block, not an
  // uncategorised one.
  const [newBlockTypeOverride, setNewBlockTypeOverride] = useState<SlotType | null>(null);
  const newBlockType = newBlockTypeOverride ?? newBlockTypeFor(palette.selected);
  const setNewBlockType = (t: SlotType) => setNewBlockTypeOverride(t);
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

  // ---- Assign to client ----
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignPatient, setAssignPatient] = useState<Patient | null>(null);
  const [assignDelivery, setAssignDelivery] = useState<"open" | "scheduled">("open");
  const [assignDays, setAssignDays] = useState<number[]>([1]);
  const [assignBlockLengthWeeks, setAssignBlockLengthWeeks] = useState(4);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigned, setAssigned] = useState(false);

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
      if (blockDesignation) params.set("designation", blockDesignation);
      if (blockUsageTagFilter) params.set("usage_tag", blockUsageTagFilter);
      const res = await fetch(`/api/clinic/blocks/search?${params.toString()}`);
      const data = await res.json();
      setBlockResults(data.blocks ?? []);
    }, 250);
    return () => clearTimeout(handle);
  }, [blockQuery, blockTypeFilter, blockDesignation, blockUsageTagFilter, pickerTab]);

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
    const key = newKey();
    setItems((prev) => [
      ...prev,
      {
        key,
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
        prescription_mode: "reps_and_sets",
        rationale: null,
      },
    ]);
    recordSelection("blocks", block.id, block.type);
    setExpandedKey(key);

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

      const detail: BlockDetail = {
        id,
        name: newBlockName.trim(),
        type: newBlockType,
        block_length_weeks: newBlockLength,
        items: [],
        sequence_type: "straight_sets",
      };
      setBlockDetailsByBlockId((prev) => ({ ...prev, [id]: detail }));
      const key = newKey();
      setItems((prev) => [
        ...prev,
        {
          key,
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
          prescription_mode: "reps_and_sets",
          rationale: null,
        },
      ]);
      setExpandedKey(key);
      setNewBlockName("");
      setShowNewBlockForm(false);
    } catch (err) {
      setNewBlockError(err instanceof Error ? err.message : "Couldn't create block.");
    } finally {
      setCreatingBlock(false);
    }
  }

  function addExercise(exercise: ExerciseOption) {
    const key = newKey();
    setItems((prev) => [
      ...prev,
      {
        key,
        slot_type: "main_body",
        block_id: null,
        block_name: null,
        exercise_id: exercise.exercise_id,
        exercise_name: exercise.name_clinical,
        cardio_block_id: null,
        cardio_block_name: null,
        cardio_modality_override: null,
        cardio_modality_other_override: null,
        ...PRESCRIPTION_DEFAULTS,
        prescription_mode: cleanPrescriptionMode(exercise.default_prescription_mode),
        rationale: null,
      },
    ]);
    recordSelection("exercises", exercise.exercise_id, "main_body");
    setExpandedKey(key);
  }

  function addCardio(cardio: CardioOption) {
    const key = newKey();
    setItems((prev) => [
      ...prev,
      {
        key,
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
        prescription_mode: "reps_and_sets",
        rationale: null,
      },
    ]);
    setExpandedKey(key);

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
      const key = newKey();
      setItems((prev) => [
        ...prev,
        {
          key,
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
          prescription_mode: "reps_and_sets",
          rationale: null,
        },
      ]);
      setExpandedKey(key);
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

  async function saveWorkout(): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        id: workoutId,
        name,
        high_load: highLoad,
        designations,
        kind,
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
          prescription_mode: item.prescription_mode,
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
                  prescription_mode: w.prescription_mode,
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
      markSaved({
        name,
        highLoad,
        designations,
        items,
        blockDetailsByBlockId,
        cardioDetailsByCardioId,
        accessWindowWeeks,
        audioUrl,
        notes,
        introLine,
      });
      onSaved?.(name, highLoad);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function uploadAudio(blob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append("programme_id", draftProgrammeId);
    formData.append("audio", blob, "recording.webm");
    const res = await fetch("/api/clinic/audio/programme", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed.");
    setAudioUrl(data.url);
    return data.url;
  }

  function handleGoalImagePick(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (goalImagePreviewUrl) URL.revokeObjectURL(goalImagePreviewUrl);
    setGoalImageFile(file);
    setGoalImagePreviewUrl(URL.createObjectURL(file));
  }

  function toggleAssignDay(day: number) {
    setAssignDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  // "These have not been assigned to a client yet" -- everything above is
  // a draft until this runs. Ensures the workout itself is saved first
  // (a Programme can only reference a real workout id), creates the real
  // Programme carrying every draft field, then -- only now that a real
  // patient and programme exist -- uploads the goal picture, since that
  // upload route needs both to already exist (see GoalImageUploader.tsx).
  async function handleAssign() {
    if (!assignPatient) {
      setAssignError("Choose a patient first.");
      return;
    }
    if (assignDelivery === "scheduled" && assignDays.length === 0) {
      setAssignError("Choose at least one day.");
      return;
    }
    setAssigning(true);
    setAssignError(null);
    try {
      const workoutSaved = await saveWorkout();
      if (!workoutSaved) {
        setAssignError("Couldn't save the workout -- fix the error above and try again.");
        return;
      }

      const assignments =
        assignDelivery === "open"
          ? [{ workout_id: workoutId, day_of_week: null }]
          : assignDays.map((d) => ({ workout_id: workoutId, day_of_week: d }));

      const res = await fetch("/api/clinic/programmes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draftProgrammeId,
          patient_id: assignPatient.id,
          title: introLine.trim() || name,
          block_length_weeks: assignDelivery === "open" ? 1 : assignBlockLengthWeeks,
          access_window_weeks: accessWindowWeeks,
          audio_url: audioUrl,
          delivery_mode: assignDelivery,
          assignments,
          notes: notes.trim() || null,
          origin: "builder",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't assign this workout.");

      if (goalImageFile) {
        const body = new FormData();
        body.set("programme_id", draftProgrammeId);
        body.set("file", goalImageFile);
        const imgRes = await fetch(`/api/clinic/patients/${assignPatient.id}/goal-image`, { method: "POST", body });
        if (!imgRes.ok) {
          // Non-fatal -- the programme itself is real and assigned; David
          // can add the goal picture from the patient's own page after.
          console.error("goal image upload failed after assign");
        }
      }

      setAssigned(true);
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Couldn't assign this workout.");
    } finally {
      setAssigning(false);
    }
  }

  const groupedItems = useMemo(() => {
    const groups = new Map<string, WorkoutItem[]>();
    for (const item of items) {
      const label = slotTypeLabel(item.slot_type);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(item);
    }
    const order = SLOT_TYPES.map((t) => t.label);
    const orderedKeys = [...order.filter((k) => groups.has(k)), ...Array.from(groups.keys()).filter((k) => !order.includes(k))];
    return orderedKeys.map((label) => ({ label, items: groups.get(label)! }));
  }, [items]);

  // The three panes are built separately so a host page can place them in
  // its own shell (see renderSlots) rather than being stuck with this one.
  const libraryPane = (
    <>
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
                <input className={clinicStyles.input} value={newBlockName} onChange={(e) => setNewBlockName(e.target.value)} />
              </div>
              <div className={clinicStyles.field}>
                <label className={clinicStyles.label}>Type</label>
                <select className={clinicStyles.input} value={newBlockType} onChange={(e) => setNewBlockType(e.target.value as SlotType)}>
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
                <select className={clinicStyles.input} value={newCardioModality} onChange={(e) => setNewCardioModality(e.target.value as CardioModality)}>
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
                <input className={clinicStyles.input} value={newCardioModalityOther} onChange={(e) => setNewCardioModalityOther(e.target.value)} />
              </div>
            )}
            <div className={clinicStyles.row2}>
              <div className={clinicStyles.field}>
                <label className={clinicStyles.label}>Structure</label>
                <select className={clinicStyles.input} value={newCardioStructure} onChange={(e) => setNewCardioStructure(e.target.value as CardioStructure)}>
                  {CARDIO_STRUCTURES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={clinicStyles.field}>
                <label className={clinicStyles.label}>Category</label>
                <select className={clinicStyles.input} value={newCardioCategory} onChange={(e) => setNewCardioCategory(e.target.value as CardioCategory)}>
                  <option value="general">General</option>
                  <option value="return_to_run">Return to Run</option>
                  <option value="running_progression">Running Progression</option>
                  <option value="cycling_progression">Cycling Progression</option>
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

        {pickerTab === "blocks" && (
          <>
            <div className={styles.pickerSearchRow}>
              <input
                className={clinicStyles.input}
                placeholder="Search blocks…"
                value={blockQuery}
                onChange={(e) => setBlockQuery(e.target.value)}
              />
              {/* Writes to the same palette state the far-left rail does,
                  so picking "Activation" here lights up Activations there
                  and vice versa. Only the two categories the rail offers
                  map back to it; the rest just filter. */}
              <select
                className={clinicStyles.input}
                style={{ maxWidth: 200 }}
                value={blockTypeFilter}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "activation" || value === "injury_prevention") {
                    palette.select(value);
                    return;
                  }
                  // Not a category the rail has a row for, so it stays on
                  // Blocks and narrows from there. select() first, since it
                  // clears any previous narrower filter.
                  palette.select("blocks");
                  palette.setBlockType(value);
                }}
              >
                <option value="">All types</option>
                {SLOT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Format is a separate axis from slot type: an activation block
                and a main-body block can both be HIIT, so this narrows
                whatever the palette is already showing rather than
                replacing it. */}
            <div className={styles.pickerSearchRow}>
              <select
                className={clinicStyles.input}
                value={blockDesignation}
                onChange={(e) => setBlockDesignation(e.target.value)}
              >
                <option value="">Any format</option>
                {DESIGNATIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
              {/* What the block is actually for, a second independent axis
                  from Type and Format -- most blocks sit in Main Body, so
                  this is what actually finds a specific one again. */}
              {usageTagCatalog.length > 0 && (
                <select
                  className={clinicStyles.input}
                  value={blockUsageTagFilter}
                  onChange={(e) => setBlockUsageTagFilter(e.target.value)}
                >
                  <option value="">Any usage tag</option>
                  {usageTagCatalog.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {!blockQuery.trim() && rankingBlocks && <div className={clinicStyles.notice}>Ranking your library…</div>}
            <div className={styles.pickerResults}>
              {blockTopPicks && blockTopPicks.length > 0 && (
                <div className={clinicStyles.smallLabel}>Suggested {blockTypeFilter ? slotTypeLabel(blockTypeFilter as SlotType).toLowerCase() : ""} blocks</div>
              )}
              {(blockTopPicks && blockTopPicks.length > 0 ? blockTopPicks.map((p) => p.item) : blockResults).map((b) => {
                const added = items.some((i) => i.block_id === b.id);
                return (
                  <div key={b.id} className={styles.pickerResultRow}>
                    <PickerThumb src={null} label={b.name} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <PickerResultBody
                        name={b.name}
                        tags={[
                          slotTypeLabel(b.type),
                          `${b.block_length_weeks}wk`,
                          ...b.designations.map(designationLabel),
                          ...b.usage_tag_ids.map((id) => usageTagsById.get(id) ?? "…"),
                        ]}
                      />
                      <DrillListToggle drillNames={b.drillNames} indent={0} />
                    </div>
                    {added ? (
                      <span style={{ fontSize: 12.5, color: "var(--graphite)" }}>✓ Added</span>
                    ) : (
                      <button type="button" className={clinicStyles.buttonSecondary} style={{ width: "auto", padding: "0 16px", height: 36 }} onClick={() => addBlock(b)}>
                        Add
                      </button>
                    )}
                  </div>
                );
              })}
              {blockResults.length === 0 && <div className={clinicStyles.notice}>No blocks match. Build one in the Blocks library first.</div>}
            </div>
          </>
        )}

        {pickerTab === "exercises" && (
          <>
            <div className={styles.pickerSearchRow}>
              <input className={clinicStyles.input} placeholder="Search exercises…" value={exerciseQuery} onChange={(e) => setExerciseQuery(e.target.value)} />
            </div>
            {rankingExercises && <div className={clinicStyles.notice}>Ranking your library…</div>}
            <div className={styles.pickerResults}>
              {(exerciseTopPicks && exerciseTopPicks.length > 0 ? exerciseTopPicks.map((p) => p.item) : exerciseResults).map((e) => {
                const added = items.some((i) => i.exercise_id === e.exercise_id);
                return (
                  <div key={e.exercise_id} className={styles.pickerResultRow}>
                    <PickerThumb src={e.thumbnail_url} label={e.name_clinical} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <PickerResultBody name={e.name_clinical} tags={[e.body_site]} />
                    </div>
                    {added ? (
                      <span style={{ fontSize: 12.5, color: "var(--graphite)" }}>✓ Added</span>
                    ) : (
                      <button type="button" className={clinicStyles.buttonSecondary} style={{ width: "auto", padding: "0 16px", height: 36 }} onClick={() => addExercise(e)}>
                        Add
                      </button>
                    )}
                  </div>
                );
              })}
              {exerciseResults.length === 0 && <div className={clinicStyles.notice}>No exercises match.</div>}
            </div>
          </>
        )}

        {pickerTab === "cardio" && (
          <>
            <div className={styles.pickerSearchRow}>
              <input className={clinicStyles.input} placeholder="Search cardio blocks…" value={cardioQuery} onChange={(e) => setCardioQuery(e.target.value)} />
              <select className={clinicStyles.input} style={{ maxWidth: 220 }} value={cardioFilter} onChange={(e) => setCardioFilter(e.target.value)}>
                <option value="">All types</option>
                <option value="steady_state">Steady-state</option>
                <option value="intervals">Intervals</option>
                <option value="return_to_run">Return to Run</option>
                <option value="running_progression">Running Progression</option>
                <option value="cycling_progression">Cycling Progression</option>
              </select>
            </div>
            <div className={styles.pickerResults}>
              {cardioResults.map((c) => {
                const added = items.some((i) => i.cardio_block_id === c.id);
                return (
                  <div key={c.id} className={styles.pickerResultRow}>
                    <PickerThumb src={null} label={c.name} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <PickerResultBody name={c.name} tags={[cardioModalityLabel(c.modality, c.modality_other), cardioGroupLabel(c)]} />
                      {c.category === "return_to_run" && c.entry_criteria && (
                        <div style={{ fontSize: 11.5, color: "var(--graphite)", marginTop: 6, lineHeight: 1.4, background: "var(--mist)", borderRadius: 6, padding: "6px 8px" }}>
                          <strong>Entry criteria:</strong> {c.entry_criteria}
                        </div>
                      )}
                    </div>
                    {added ? (
                      <span style={{ fontSize: 12.5, color: "var(--graphite)" }}>✓ Added</span>
                    ) : (
                      <button type="button" className={clinicStyles.buttonSecondary} style={{ width: "auto", padding: "0 16px", height: 36 }} onClick={() => addCardio(c)}>
                        Add
                      </button>
                    )}
                  </div>
                );
              })}
              {cardioResults.length === 0 && <div className={clinicStyles.notice}>No cardio blocks match. Create one above.</div>}
            </div>
          </>
        )}
    </>
  );

  const centrePane = (
    <div className={styles.centrePane}>
          <div className={styles.centrePaneTitle}>Replica of client view</div>
          {items.length === 0 ? (
            <p style={{ fontSize: 14, color: "var(--stone)" }}>Add blocks, cardio, or a standalone exercise above to see it here.</p>
          ) : (
            <div className={styles.previewList}>
              {groupedItems.map((group) => (
                <div key={group.label}>
                  {group.items.map((item) => {
                    const globalIndex = items.findIndex((i) => i.key === item.key);
                    const category = categoryForItem(item);
                    const meta = categoryMeta(category);
                    const accent = meta?.accent ?? "var(--graphite)";
                    const blockDetail = item.block_id ? blockDetailsByBlockId[item.block_id] : undefined;
                    const sequenceType = (blockDetail?.sequence_type as SequenceType | undefined) ?? "straight_sets";
                    const badge = badgeForSequenceType(sequenceType);
                    const isExpanded = expandedKey === item.key;
                    const displayName = item.block_name ?? item.cardio_block_name ?? item.exercise_name ?? "";
                    const cardioDetail = item.cardio_block_id ? cardioDetailsByCardioId[item.cardio_block_id] : undefined;

                    return (
                      <div key={item.key} style={{ marginBottom: 14 }}>
                        {badge && (
                          <div className={styles.seqBadgeRow}>
                            <span className={styles.seqBadge} style={{ background: accent }}>
                              {badge}
                            </span>
                          </div>
                        )}
                        <div className={styles.previewCard}>
                          <button
                            type="button"
                            className={styles.previewCardHeader}
                            style={{ background: accent }}
                            onClick={() => setExpandedKey(isExpanded ? null : item.key)}
                          >
                            <span className={styles.previewCardName}>{displayName}</span>
                            <span className={styles.previewCardMeta}>
                              {item.cardio_block_id
                                ? cardioDetail
                                  ? cardioPlainSummary(cardioDetail)
                                  : "Cardio"
                                : item.sets || item.reps
                                  ? `${item.sets ?? "-"} sets × ${item.reps ?? "-"} reps`
                                  : sourceTag(item)}
                            </span>
                          </button>
                          {isExpanded && (
                            <div className={styles.previewCardBody}>
                              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                                <button
                                  type="button"
                                  className={clinicStyles.buttonSecondary}
                                  style={{ width: "auto", padding: "0 12px", height: 32, borderColor: "var(--stone)" }}
                                  disabled={globalIndex === 0}
                                  onClick={() => moveItem(globalIndex, -1)}
                                >
                                  ↑ Move up
                                </button>
                                <button
                                  type="button"
                                  className={clinicStyles.buttonSecondary}
                                  style={{ width: "auto", padding: "0 12px", height: 32, borderColor: "var(--stone)" }}
                                  disabled={globalIndex === items.length - 1}
                                  onClick={() => moveItem(globalIndex, 1)}
                                >
                                  ↓ Move down
                                </button>
                                <button
                                  type="button"
                                  className={clinicStyles.buttonDestructive}
                                  style={{ width: "auto", padding: "0 12px", height: 32 }}
                                  onClick={() => removeItem(globalIndex)}
                                >
                                  Remove
                                </button>
                              </div>
                              <ItemExtra
                                item={item}
                                onChange={(patch) => updateItem(item.key, patch)}
                                blockDetail={blockDetail}
                                exerciseLibrary={exerciseLibrary}
                                onChangeBlockItems={item.block_id ? (newItems) => updateBlockItems(item.block_id!, newItems) : undefined}
                                cardioDetail={cardioDetail}
                                onChangeCardio={item.cardio_block_id ? (patch) => updateCardioBlock(item.cardio_block_id!, patch) : undefined}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
    </div>
  );

  // Just the two fields David needs before he starts picking exercises --
  // everything else that used to share this rail with them now lives
  // below the builder, out of the way while he's working. Split in two
  // (lead/tail) rather than one block so a host that has its own bottom
  // content (the Programme builder's patient card, access window, etc.)
  // can sandwich it between the two -- high-load flag first, Save workout
  // last, same as the standalone page's own order when nothing is sandwiched
  // in between.
  const topBarPane = (
    <div className={styles.topBar}>
      <div className={styles.topBarField}>
        <label className={styles.topBarLabel}>{workoutKindLabel(kind)} name</label>
        <input className={styles.topBarInput} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className={`${styles.topBarField} ${styles.topBarFieldNarrow}`}>
        <label className={styles.topBarLabel}>Format</label>
        <DesignationPicker selected={designations} onChange={setDesignations} compact />
      </div>
    </div>
  );

  const bottomLead = (
    <div className={styles.controlCard}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--graphite)" }}>
        <input type="checkbox" checked={highLoad} onChange={(e) => setHighLoad(e.target.checked)} />
        High-load day (heavy strength, or a hard interval run)
      </label>
    </div>
  );

  const bottomTail = (
    <>
        {!hideProgrammeControls && (
        <div className={styles.controlCard}>
          <div className={styles.controlCardTitle}>Access window (weeks)</div>
          <div className={styles.stepperRow}>
            <button
              type="button"
              className={styles.stepperButton}
              disabled={accessWindowWeeks == null || accessWindowWeeks <= 1}
              onClick={() => setAccessWindowWeeks((w) => Math.max(1, (w ?? 1) - 1))}
            >
              −
            </button>
            <div className={styles.stepperValue}>{accessWindowWeeks ?? "None"}</div>
            <button type="button" className={styles.stepperButton} onClick={() => setAccessWindowWeeks((w) => Math.min(52, (w ?? 0) + 1))}>
              +
            </button>
            <span className={styles.stepperUnit}>{accessWindowWeeks == null ? "never closes" : "weeks"}</span>
          </div>
          <button
            type="button"
            onClick={() => setAccessWindowWeeks((w) => (w == null ? 6 : null))}
            style={{ marginTop: 10, background: "none", border: "none", padding: 0, fontSize: 12.5, color: "var(--accent-content)", cursor: "pointer" }}
          >
            {accessWindowWeeks == null ? "Set a window" : "Clear, never closes"}
          </button>
        </div>
        )}

        {!hideProgrammeControls && (
        <div className={styles.controlCard}>
          <div className={styles.controlCardTitle}>Programme message</div>
          <AudioRecorder existingUrl={audioUrl} onUpload={uploadAudio} />
        </div>
        )}

        {!hideProgrammeControls && (
        <div className={styles.controlCard}>
          <div className={styles.controlCardTitle}>Programme notes</div>
          <textarea className={styles.bigTextarea} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Your own reasoning, for your own record." />
          <div style={{ marginTop: 14 }}>
            <label className={styles.controlLabel}>Goal picture</label>
            {goalImagePreviewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={goalImagePreviewUrl} alt="" className={styles.goalImagePreview} />
            )}
            <div className={styles.goalImageDrop} onClick={() => document.getElementById("workout-goal-image-input")?.click()}>
              {goalImageFile ? "Drop a new photo here, or click to replace" : "Drag a photo here, or click to choose one"}
              <input
                id="workout-goal-image-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => {
                  handleGoalImagePick(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </div>
            <p className={clinicStyles.notice} style={{ marginTop: 6 }}>
              Uploaded once this is assigned to a client -- there's no patient to attach it to yet.
            </p>
          </div>
        </div>
        )}

        {!hideProgrammeControls && (
        <div className={styles.controlCard}>
          <div className={styles.controlCardTitle}>Intro line</div>
          <input className={styles.bigInput} value={introLine} onChange={(e) => setIntroLine(e.target.value)} placeholder="Shown to the client at the top of their programme." />
        </div>
        )}

        {error && <div className={clinicStyles.error}>{error}</div>}

        <button type="button" className={clinicStyles.buttonSecondary} disabled={saving || !name.trim() || items.length === 0} onClick={saveWorkout}>
          {saving ? "Saving…" : saved ? "Save changes" : "Save workout"}
        </button>

        {hideProgrammeControls ? null : !assignOpen ? (
          <button type="button" className={styles.assignButton} disabled={items.length === 0} onClick={() => setAssignOpen(true)}>
            Assign to client
          </button>
        ) : assigned ? (
          <div className={styles.controlCard}>
            <div className={styles.controlCardTitle}>Assigned</div>
            <p style={{ fontSize: 13.5, color: "var(--graphite)" }}>
              &ldquo;{name}&rdquo; is in {assignPatient?.first_name}&apos;s programme now.
            </p>
            <button type="button" className={clinicStyles.buttonSecondary} style={{ marginTop: 10 }} onClick={() => router.push(`/clinic/patients/${assignPatient?.id}`)}>
              View their record
            </button>
          </div>
        ) : (
          <div className={styles.controlCard}>
            <div className={styles.controlCardTitle}>Assign to client</div>
            <div className={styles.assignPanel}>
              <PatientPicker selected={assignPatient} onSelect={setAssignPatient} />

              <div>
                <label className={styles.controlLabel}>Delivery</label>
                <div className={styles.deliveryChoice}>
                  <button
                    type="button"
                    className={`${styles.deliveryChoiceButton} ${assignDelivery === "open" ? styles.deliveryChoiceButtonActive : ""}`}
                    onClick={() => setAssignDelivery("open")}
                  >
                    Unscheduled
                  </button>
                  <button
                    type="button"
                    className={`${styles.deliveryChoiceButton} ${assignDelivery === "scheduled" ? styles.deliveryChoiceButtonActive : ""}`}
                    onClick={() => setAssignDelivery("scheduled")}
                  >
                    Scheduled
                  </button>
                </div>
              </div>

              {assignDelivery === "scheduled" && (
                <>
                  <div>
                    <label className={styles.controlLabel}>Which day(s)</label>
                    <div className={styles.dayChips}>
                      {DAY_LABELS.map((d) => (
                        <button
                          key={d.value}
                          type="button"
                          className={`${styles.dayChip} ${assignDays.includes(d.value) ? styles.dayChipActive : ""}`}
                          onClick={() => toggleAssignDay(d.value)}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={styles.controlLabel}>Block length (weeks)</label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      className={styles.bigInput}
                      style={{ maxWidth: 140 }}
                      value={assignBlockLengthWeeks}
                      onChange={(e) => setAssignBlockLengthWeeks(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                    />
                  </div>
                </>
              )}

              {assignError && <div className={clinicStyles.error}>{assignError}</div>}

              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className={styles.assignButton} disabled={assigning} onClick={handleAssign}>
                  {assigning ? "Assigning…" : "Confirm assign"}
                </button>
                <button type="button" className={clinicStyles.buttonSecondary} onClick={() => setAssignOpen(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );

  if (renderSlots) {
    return (
      <>{renderSlots({ library: libraryPane, centre: centrePane, topBar: topBarPane, bottomLead, bottomTail })}</>
    );
  }

  return (
    <>
      {topBarPane}
      <BuilderShell library={libraryPane} libraryTitle="Content library" centre={centrePane} controls={null} />
      <div className={clinicStyles.bottomSection}>
        {bottomLead}
        {bottomTail}
      </div>
    </>
  );
}

function sourceTag(item: WorkoutItem): string {
  if (item.block_id) return "Block";
  if (item.cardio_block_id) return "Cardio";
  return "Standalone";
}

// slot_type alone can't tell a cardio reference apart from a standalone
// exercise -- both default to "main_body" (see addExercise/addCardio above)
// -- so a cardio reference always reads as the Cardio category regardless
// of what its slot_type happens to be.
function categoryForItem(item: WorkoutItem): BlockCategory {
  if (item.cardio_block_id) return "cardio";
  return item.slot_type;
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
      <select className={styles.slotSelect} value={item.slot_type} onChange={(e) => onChange({ slot_type: e.target.value as SlotType })}>
        {SLOT_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      {item.exercise_id && (
        <>
          <div className={styles.fieldLabel} style={{ marginTop: 8 }}>Prescribed by</div>
          <PrescriptionModeToggle
            value={cleanPrescriptionMode(item.prescription_mode)}
            onChange={(prescription_mode) => onChange({ prescription_mode })}
          />
          <div className={styles.fieldGrid}>
            <div>
              <div className={styles.fieldLabel}>Sets</div>
              <input type="number" className={styles.fieldInput} value={item.sets ?? ""} onChange={(e) => onChange({ sets: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>
            {fieldsForMode(item.prescription_mode).showReps && (
              <div>
                <div className={styles.fieldLabel}>Reps</div>
                <input type="number" className={styles.fieldInput} value={item.reps ?? ""} onChange={(e) => onChange({ reps: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
            )}
            {fieldsForMode(item.prescription_mode).showHoldAndMax && (
              <>
                <div>
                  <div className={styles.fieldLabel}>Hold (s)</div>
                  <input type="number" className={styles.fieldInput} value={item.hold_seconds ?? ""} onChange={(e) => onChange({ hold_seconds: e.target.value === "" ? null : Number(e.target.value) })} />
                </div>
                <div>
                  <div className={styles.fieldLabel}>% max</div>
                  <input type="number" className={styles.fieldInput} value={item.percent_max ?? ""} onChange={(e) => onChange({ percent_max: e.target.value === "" ? null : Number(e.target.value) })} />
                </div>
              </>
            )}
            <div>
              <div className={styles.fieldLabel}>Frequency</div>
              <input className={styles.fieldInput} value={item.frequency ?? ""} onChange={(e) => onChange({ frequency: e.target.value || null })} />
            </div>
          </div>
        </>
      )}

      {item.block_id && blockDetail && onChangeBlockItems && <BlockGroupEditor block={blockDetail} exerciseLibrary={exerciseLibrary} onChange={onChangeBlockItems} />}
      {item.block_id && !blockDetail && <div className={styles.fieldLabel} style={{ marginTop: 8 }}>Loading this block&apos;s exercises…</div>}

      {item.cardio_block_id && cardioDetail && (
        <div className={styles.fieldGrid} style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <div className={styles.fieldLabel}>Modality for this patient</div>
            <select
              className={styles.slotSelect}
              value={item.cardio_modality_override ?? cardioDetail.modality}
              onChange={(e) => onChange({ cardio_modality_override: e.target.value as CardioModality, cardio_modality_other_override: null })}
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
              <input className={styles.fieldInput} value={item.cardio_modality_other_override ?? ""} onChange={(e) => onChange({ cardio_modality_other_override: e.target.value || null })} />
            </div>
          )}
        </div>
      )}

      {item.cardio_block_id && cardioDetail && onChangeCardio && <CardioBlockEditor cardio={cardioDetail} onChange={onChangeCardio} />}
      {item.cardio_block_id && !cardioDetail && <div className={styles.fieldLabel} style={{ marginTop: 8 }}>Loading this cardio block…</div>}
    </div>
  );
}
