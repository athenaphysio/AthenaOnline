"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import styles from "./ProgrammeCanvas.module.css";
import WorkoutEditorInline from "./WorkoutEditorInline";
import PlanCardEditor from "./PlanCardEditor";
import { useBuilderPalette } from "../BuilderPaletteContext";
import { SCHEDULE_CONTENT_KEYS } from "@/lib/builderPalette";
import { isRestDay, CARD_TYPE_LABEL, type PlanCardData } from "@/lib/planToBuilder";
import type { WorkoutAssignment, WorkoutOption } from "./ProgrammeBuilder";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_VALUES = [1, 2, 3, 4, 5, 6, 7];

// A small, muted palette that sits next to crimson/cream/sand without being
// confused with it -- crimson stays reserved for primary actions/links.
const PALETTE = [
  "#5b7c72", // sage-teal
  "#5c7a99", // dusty blue
  "#a67c3d", // ochre
  "#7d5875", // plum
  "#7c7c4a", // olive
  "#a35c3f", // terracotta
  "#5a6570", // slate
  "#6b8752", // moss
];

const CARD_COLOR: Record<string, string> = {
  run: "#5c7a99",
  bike: "#6b8752",
  swim: "#5b7c72",
  other: "#5a6570",
  strength: "#a67c3d",
};

function colorVar(color: string | undefined): CSSProperties {
  return { "--session-color": color ?? "var(--border)" } as CSSProperties;
}

type Target = { week: number; day: number; replaceKey: string | null };

type Props = {
  blockLengthWeeks: number;
  assignments: WorkoutAssignment[];
  /** True once any session is tied to one week. From then on every cell is
   * its own place and a day can hold more than one session. */
  perWeek: boolean;
  weekLabels: Record<number, string>;
  /** Rest days: 1 to 7 is that weekday every week; week * 10 + weekday is
   * one day in one week. */
  restDays: number[];
  onAssignToDay: (workout: WorkoutOption, day: number, week: number | null, replaceKey: string | null) => void;
  onToggleDay: (key: string, day: number) => void;
  onRemove: (key: string) => void;
  onToggleRest: (day: number, week: number | null) => void;
  onMoveSession: (key: string, week: number, day: number) => void;
  onUpdateCard: (key: string, patch: Partial<PlanCardData>) => void;
  onDuplicateCard: (key: string) => void;
  onSaveCardToLibrary: (key: string) => void;
  onConfirmDay: (key: string) => void;
  onWorkoutRenamed: (workoutId: string, newName: string, highLoad: boolean) => void;
  /** Hand the calendar and its workout library back separately, so the host
   * page can pin the library in its own rail instead of squeezing it into
   * the grid. Also forwarded to the day's workout editor, so opening a day
   * puts that workout's own library in the same rail. */
  renderSlots?: (panes: { canvas: ReactNode; library: ReactNode }) => ReactNode;
};

export default function ProgrammeCanvas({
  blockLengthWeeks,
  assignments,
  perWeek,
  weekLabels,
  restDays,
  onAssignToDay,
  onToggleDay,
  onRemove,
  onToggleRest,
  onMoveSession,
  onUpdateCard,
  onDuplicateCard,
  onSaveCardToLibrary,
  onConfirmDay,
  onWorkoutRenamed,
  renderSlots,
}: Props) {
  const [target, setTarget] = useState<Target | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WorkoutOption[]>([]);
  const [hasAiScaffold, setHasAiScaffold] = useState(false);
  const [kindFilter, setKindFilter] = useState<"" | "standard" | "cardio">("");
  const [draggedWorkout, setDraggedWorkout] = useState<WorkoutOption | null>(null);
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(async () => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (kindFilter) params.set("kind", kindFilter);
      const res = await fetch(`/api/clinic/workouts/search?${params.toString()}`);
      const data = await res.json();
      setResults(data.workouts ?? []);
    }, 250);
    return () => clearTimeout(handle);
  }, [query, kindFilter]);

  // Best-effort, device-local signal -- the same one the scaffold generator
  // already writes (src/app/clinic/programmes/ProgrammeBuilder.tsx's
  // runGenerate). Not persisted server-side, so this can miss on a
  // different device -- an accepted, pre-existing limitation of that
  // feature, not new here.
  useEffect(() => {
    try {
      const found = assignments.some((a) => localStorage.getItem(`athena_workout_context:${a.workout_id}`) !== null);
      setHasAiScaffold(found);
    } catch {
      setHasAiScaffold(false);
    }
  }, [assignments]);

  const colorByWorkout = useMemo(() => {
    const map = new Map<string, string>();
    let i = 0;
    for (const a of assignments) {
      if (!map.has(a.workout_id)) {
        map.set(a.workout_id, PALETTE[i % PALETTE.length]);
        i += 1;
      }
    }
    return map;
  }, [assignments]);

  // Every-week sessions only: the original one-session-per-weekday map.
  const byDay = useMemo(() => {
    const map = new Map<number, WorkoutAssignment>();
    for (const a of assignments) {
      if (a.week != null) continue;
      // ProgrammeCanvas only ever renders Scheduled assignments -- real day
      // numbers -- but the shared WorkoutAssignment type also allows the
      // null day Open programmes use, so this is filtered defensively.
      for (const d of a.days) {
        if (d != null) map.set(d, a);
      }
    }
    return map;
  }, [assignments]);

  // What sits in one cell, in plan order: every-week sessions for that
  // weekday, plus anything tied to exactly this week.
  function cellRows(week: number, day: number): WorkoutAssignment[] {
    return assignments
      .filter((a) => a.days.includes(day) && (a.week == null || a.week === week))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  // A gentle, non-blocking prompt -- never a rule the app enforces -- when
  // two days the clinician has marked high-load (WorkoutBuilder.tsx) land
  // back to back with nothing easier between them. Includes the Sun-into-
  // Mon wrap, since that's a genuine back-to-back in the client's actual
  // week even though the grid draws it as two separate columns.
  const highLoadConflicts = useMemo(() => {
    const adjacentPairs: [number, number][] = [
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 1],
    ];
    const conflicts: [string, string][] = [];
    for (const [dayA, dayB] of adjacentPairs) {
      if (byDay.get(dayA)?.high_load && byDay.get(dayB)?.high_load) {
        conflicts.push([DAY_LABELS[dayA - 1], DAY_LABELS[dayB - 1]]);
      }
    }
    return conflicts;
  }, [byDay]);

  const selectedAssignment = assignments.find((a) => a.key === selectedKey) ?? null;
  const weeks = Array.from({ length: Math.max(1, blockLengthWeeks) }, (_, i) => i + 1);

  function isTargeted(week: number, day: number): boolean {
    if (!target) return false;
    return perWeek ? target.week === week && target.day === day : target.day === day;
  }

  function selectCell(week: number, day: number) {
    setTarget({ week, day, replaceKey: null });
    setSelectedKey(null);
  }

  // Legacy (every-week) cells: a session there is opened; an empty one is
  // targeted. Per-week cells: the cell itself only ever targets, and each
  // card inside it handles its own click.
  function handleCellClick(week: number, day: number) {
    if (!perWeek) {
      const existing = byDay.get(day);
      if (existing) {
        setSelectedKey(existing.key);
        setTarget(null);
        return;
      }
    }
    selectCell(week, day);
  }

  function handleCardClick(a: WorkoutAssignment, week: number, day: number) {
    if (a.plan?.type === "strength") {
      // An empty strength slot: choose a library item to fill it.
      setTarget({ week, day, replaceKey: a.key });
      setSelectedKey(null);
      return;
    }
    setSelectedKey(a.key);
    setTarget(null);
  }

  // The calendar takes whole workouts onto days, so that is what the rail
  // offers here. When a day's workout is opened below, WorkoutBuilder
  // registers its own content types and takes the rail over.
  const { setSupported } = useBuilderPalette();
  const editingLibraryWorkout = selectedAssignment != null && !selectedAssignment.plan;
  useEffect(() => {
    if (editingLibraryWorkout) return;
    setSupported(SCHEDULE_CONTENT_KEYS);
    return () => setSupported([]);
  }, [setSupported, editingLibraryWorkout]);

  function handleAdd(workout: WorkoutOption) {
    if (!target) return;
    onAssignToDay(workout, target.day, perWeek ? target.week : null, target.replaceKey);
    setTarget(null);
  }

  const targetLabel = target ? `${DAY_LABELS[target.day - 1]}${perWeek ? `, week ${target.week}` : ""}` : "";
  const targetIsRest = target ? isRestDay(restDays, target.week, target.day) : false;

  const workoutLibrary = (
    <>
      <input
        className={styles.searchInput}
        placeholder="Search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className={styles.chipRow}>
        {(
          [
            ["", "All"],
            ["standard", "Strength"],
            ["cardio", "Cardio"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={label}
            type="button"
            className={`${styles.chip} ${kindFilter === value ? styles.chipActive : ""}`}
            onClick={() => setKindFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {target == null ? (
        <div className={styles.hint}>Tap a day, then tap a session to add it, or drag a session onto a day.</div>
      ) : (
        <div className={styles.hint}>
          {target.replaceKey ? `Choose the strength session for ${targetLabel}.` : `Adding a session to ${targetLabel}.`}{" "}
          {!target.replaceKey && (
            <button
              type="button"
              className={styles.textButton}
              onClick={() => {
                onToggleRest(target.day, perWeek ? target.week : null);
                setTarget(null);
              }}
            >
              {targetIsRest ? "Clear rest day" : "Mark as rest day"}
            </button>
          )}
        </div>
      )}
      <div className={styles.resultList}>
        {results.length === 0 && <div className={styles.emptyState}>No sessions match.</div>}
        {results.map((w) => (
          <div
            key={w.id}
            className={styles.resultRow}
            onClick={() => handleAdd(w)}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", w.id);
              e.dataTransfer.effectAllowed = "copy";
              setDraggedWorkout(w);
            }}
            onDragEnd={() => {
              setDraggedWorkout(null);
              setDragOverCell(null);
            }}
          >
            <span className={styles.swatch} style={{ background: colorByWorkout.get(w.id) ?? "var(--border)" }} />
            <span className={styles.resultName}>{w.name}</span>
            <button type="button" className={styles.addButton} disabled={target == null}>
              {target == null ? "Add" : `Add to ${DAY_LABELS[target.day - 1]}`}
            </button>
          </div>
        ))}
      </div>
    </>
  );

  const header = (
    <>
      {hasAiScaffold && (
        <div className={styles.topBar}>
          <span className={styles.aiNote}>✨ Includes an AI-generated scaffold</span>
        </div>
      )}

      {highLoadConflicts.length > 0 && (
        <div className={styles.loadNote}>
          {highLoadConflicts.map(([a, b]) => (
            <div key={`${a}-${b}`}>
              {a} and {b} are both marked high-load, scheduled back to back. Worth a look, not a rule.
            </div>
          ))}
        </div>
      )}
    </>
  );

  const editingHeader = selectedAssignment && !selectedAssignment.plan && (
    <div className={styles.editingHeader}>
      <button type="button" className={styles.backLink} onClick={() => setSelectedKey(null)}>
        ← Back to week grid
      </button>
      <span className={styles.editingName}>{selectedAssignment.workout_name}</span>
      <div className={styles.dayChipRow} style={colorVar(colorByWorkout.get(selectedAssignment.workout_id))}>
        {DAY_LABELS.map((label, i) => {
          const day = i + 1;
          const active = selectedAssignment.days.includes(day);
          return (
            <button
              key={day}
              type="button"
              className={`${styles.dayChip} ${active ? styles.dayChipActive : ""}`}
              onClick={() => onToggleDay(selectedAssignment.key, day)}
            >
              {label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className={styles.removeButton}
        onClick={() => {
          onRemove(selectedAssignment.key);
          setSelectedKey(null);
        }}
      >
        Remove from schedule
      </button>
    </div>
  );

  function dropOnCell(e: React.DragEvent, week: number, day: number) {
    e.preventDefault();
    if (draggedKey) {
      onMoveSession(draggedKey, week, day);
    } else if (draggedWorkout) {
      onAssignToDay(draggedWorkout, day, perWeek ? week : null, null);
    }
    setDraggedWorkout(null);
    setDraggedKey(null);
    setDragOverCell(null);
    setTarget(null);
  }

  function renderTile(a: WorkoutAssignment, week: number, day: number) {
    const plan = a.plan;
    if (!plan) {
      return (
        <div
          key={a.key}
          className={`${styles.session} ${selectedKey === a.key ? styles.selected : ""}`}
          style={colorVar(colorByWorkout.get(a.workout_id))}
          onClick={(e) => {
            e.stopPropagation();
            handleCardClick(a, week, day);
          }}
          draggable={perWeek}
          onDragStart={() => setDraggedKey(a.key)}
          onDragEnd={() => {
            setDraggedKey(null);
            setDragOverCell(null);
          }}
        >
          <span className={styles.sessionName}>{a.workout_name}</span>
          {a.high_load && (
            <span className={styles.highLoadBadge} title="Marked high-load">
              High load
            </span>
          )}
        </div>
      );
    }
    const isSlot = plan.type === "strength";
    return (
      <div
        key={a.key}
        className={`${styles.session} ${styles.planCard} ${isSlot ? styles.strengthSlot : ""} ${
          selectedKey === a.key ? styles.selected : ""
        }`}
        style={colorVar(CARD_COLOR[plan.type] ?? "#5a6570")}
        onClick={(e) => {
          e.stopPropagation();
          handleCardClick(a, week, day);
        }}
        draggable
        onDragStart={() => setDraggedKey(a.key)}
        onDragEnd={() => {
          setDraggedKey(null);
          setDragOverCell(null);
        }}
        title={isSlot ? "Strength: add from library" : plan.title}
      >
        <span className={styles.planCardTitle}>{isSlot ? "Strength: add from library" : plan.title}</span>
        <span className={styles.cardShort}>{isSlot ? "Str" : CARD_TYPE_LABEL[plan.type]}</span>
        {a.dayNotSet && (
          <button
            type="button"
            className={styles.dayTag}
            title="Tap to confirm this day"
            onClick={(e) => {
              e.stopPropagation();
              onConfirmDay(a.key);
            }}
          >
            Day not set, move if needed
          </button>
        )}
      </div>
    );
  }

  function renderCell(week: number, day: number) {
    const rows = cellRows(week, day);
    const cellKey = `${week}-${day}`;
    const targeted = isTargeted(week, day) || dragOverCell === cellKey;
    return (
      <div
        key={day}
        className={`${styles.dayCell} ${targeted ? styles.targeted : ""}`}
        onClick={() => handleCellClick(week, day)}
        onDragOver={(e) => {
          if (!draggedWorkout && !draggedKey) return;
          e.preventDefault();
          setDragOverCell(cellKey);
        }}
        onDragLeave={() => setDragOverCell((c) => (c === cellKey ? null : c))}
        onDrop={(e) => dropOnCell(e, week, day)}
      >
        {rows.length > 0 ? (
          <>
            {rows.map((a) => renderTile(a, week, day))}
            {perWeek && <div className={styles.addMore}>+</div>}
          </>
        ) : (
          <div className={isRestDay(restDays, week, day) ? styles.rest : styles.plus}>
            {isRestDay(restDays, week, day) ? "Rest" : "+"}
          </div>
        )}
      </div>
    );
  }

  const grid = (
    <div className={renderSlots ? undefined : styles.layout}>
      <div className={styles.gridPane}>
        <div className={styles.gridScroll}>
          <div className={styles.dayHeaderRow}>
            <div />
            {DAY_LABELS.map((d) => (
              <div key={d} className={styles.dayHeaderCell}>
                {d}
              </div>
            ))}
          </div>
          {weeks.map((week) => (
            <div key={week} className={styles.weekRow}>
              <div className={styles.weekLabel}>
                <span>Wk {week}</span>
                {weekLabels[week] && <span className={styles.weekTag}>{weekLabels[week]}</span>}
              </div>
              {DAY_VALUES.map((day) => renderCell(week, day))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const cardEditor =
    selectedAssignment && selectedAssignment.plan ? (
      <PlanCardEditor
        plan={selectedAssignment.plan}
        week={selectedAssignment.week ?? 1}
        day={selectedAssignment.days[0] ?? 1}
        weekCount={weeks.length}
        savedToLibrary={Boolean(selectedAssignment.savedToLibrary)}
        onChange={(patch) => onUpdateCard(selectedAssignment.key, patch)}
        onMove={(w, d) => onMoveSession(selectedAssignment.key, w, d)}
        onDuplicate={() => {
          onDuplicateCard(selectedAssignment.key);
          setSelectedKey(null);
        }}
        onDelete={() => {
          onRemove(selectedAssignment.key);
          setSelectedKey(null);
        }}
        onSaveToLibrary={() => onSaveCardToLibrary(selectedAssignment.key)}
        onClose={() => setSelectedKey(null)}
      />
    ) : null;

  // Opening a day hands that workout's own library up to the same rail the
  // calendar was using, so the rail is always "what can I add right now"
  // and the workout never renders a second shell inside this one.
  if (renderSlots && selectedAssignment && !selectedAssignment.plan) {
    return (
      <WorkoutEditorInline
        workoutId={selectedAssignment.workout_id}
        defaultBlockLengthWeeks={blockLengthWeeks}
        hideProgrammeControls
        onSaved={(newName, highLoad) => onWorkoutRenamed(selectedAssignment.workout_id, newName, highLoad)}
        renderSlots={({ library, centre }) =>
          renderSlots({
            canvas: (
              <>
                {header}
                {editingHeader}
                {centre}
              </>
            ),
            library,
          })
        }
      />
    );
  }

  if (renderSlots) {
    return renderSlots({
      canvas: (
        <>
          {header}
          {cardEditor ?? grid}
        </>
      ),
      library: workoutLibrary,
    });
  }

  return (
    <div className={styles.wrapper}>
      {header}
      {cardEditor ? (
        <div className={styles.editingArea}>{cardEditor}</div>
      ) : selectedAssignment ? (
        <div className={styles.editingArea}>
          {editingHeader}
          <WorkoutEditorInline
            workoutId={selectedAssignment.workout_id}
            defaultBlockLengthWeeks={blockLengthWeeks}
            onSaved={(newName, highLoad) => onWorkoutRenamed(selectedAssignment.workout_id, newName, highLoad)}
          />
        </div>
      ) : (
        <div className={styles.layout}>
          {grid}
          <div className={styles.rightPane}>
            <div className={styles.paneTitle}>Workout library</div>
            {workoutLibrary}
          </div>
        </div>
      )}
    </div>
  );
}
