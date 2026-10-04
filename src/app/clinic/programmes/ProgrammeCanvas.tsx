"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import styles from "./ProgrammeCanvas.module.css";
import WorkoutEditorInline from "./WorkoutEditorInline";
import { useBuilderPalette } from "../BuilderPaletteContext";
import { SCHEDULE_CONTENT_KEYS } from "@/lib/builderPalette";
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

function colorVar(color: string | undefined): CSSProperties {
  return { "--session-color": color ?? "var(--border)" } as CSSProperties;
}

type Props = {
  title: string;
  patientName: string | null;
  blockLengthWeeks: number;
  assignments: WorkoutAssignment[];
  onAssignToDay: (workout: WorkoutOption, day: number) => void;
  onToggleDay: (key: string, day: number) => void;
  onRemove: (key: string) => void;
  /** Days (1 to 7) David has deliberately marked as rest days. */
  restDays: number[];
  onToggleRest: (day: number) => void;
  onWorkoutRenamed: (workoutId: string, newName: string, highLoad: boolean) => void;
  /** Hand the calendar and its workout library back separately, so the host
   * page can pin the library in its own rail instead of squeezing it into
   * the grid. Also forwarded to the day's workout editor, so opening a day
   * puts that workout's own library in the same rail. */
  renderSlots?: (panes: { canvas: ReactNode; library: ReactNode }) => ReactNode;
};

export default function ProgrammeCanvas({
  title,
  patientName,
  blockLengthWeeks,
  assignments,
  onAssignToDay,
  onToggleDay,
  onRemove,
  restDays,
  onToggleRest,
  onWorkoutRenamed,
  renderSlots,
}: Props) {
  const [targetDay, setTargetDay] = useState<number | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WorkoutOption[]>([]);
  const [hasAiScaffold, setHasAiScaffold] = useState(false);
  const [kindFilter, setKindFilter] = useState<"" | "standard" | "cardio">("");
  const [draggedWorkout, setDraggedWorkout] = useState<WorkoutOption | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);

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

  const byDay = useMemo(() => {
    const map = new Map<number, WorkoutAssignment>();
    for (const a of assignments) {
      // ProgrammeCanvas only ever renders Scheduled assignments -- real day
      // numbers -- but the shared WorkoutAssignment type also allows the
      // null day Open programmes use, so this is filtered defensively.
      for (const d of a.days) {
        if (d != null) map.set(d, a);
      }
    }
    return map;
  }, [assignments]);

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

  const sessionsPerWeek = new Set(assignments.flatMap((a) => a.days)).size;
  const selectedAssignment = assignments.find((a) => a.key === selectedKey) ?? null;
  const weeks = Array.from({ length: Math.max(1, blockLengthWeeks) }, (_, i) => i + 1);

  function handleCellClick(day: number) {
    const existing = byDay.get(day);
    if (existing) {
      setSelectedKey(existing.key);
      setTargetDay(null);
    } else {
      setTargetDay(day);
      setSelectedKey(null);
    }
  }

  // The calendar takes whole workouts onto days, so that is what the rail
  // offers here. When a day's workout is opened below, WorkoutBuilder
  // registers its own content types and takes the rail over.
  const { setSupported } = useBuilderPalette();
  useEffect(() => {
    if (selectedKey != null) return;
    setSupported(SCHEDULE_CONTENT_KEYS);
    return () => setSupported([]);
  }, [setSupported, selectedKey]);

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
      {targetDay == null ? (
        <div className={styles.hint}>Tap a day, then tap a session to add it, or drag a session onto a day.</div>
      ) : (
        <div className={styles.hint}>
          Adding a session to {DAY_LABELS[targetDay - 1]}.{" "}
          <button type="button" className={styles.textButton} onClick={() => { onToggleRest(targetDay); setTargetDay(null); }}>
            {restDays.includes(targetDay) ? "Clear rest day" : "Mark as rest day"}
          </button>
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
              setDragOverDay(null);
            }}
          >
            <span className={styles.swatch} style={{ background: colorByWorkout.get(w.id) ?? "var(--border)" }} />
            <span className={styles.resultName}>{w.name}</span>
            <button type="button" className={styles.addButton} disabled={targetDay == null}>
              {targetDay == null ? "Add" : `Add to ${DAY_LABELS[targetDay - 1]}`}
            </button>
          </div>
        ))}
      </div>
    </>
  );

  function handleAdd(workout: WorkoutOption) {
    if (targetDay == null) return;
    onAssignToDay(workout, targetDay);
    setTargetDay(null);
  }

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

  const editingHeader = selectedAssignment && (
          <div className={styles.editingHeader}>
            <button type="button" className={styles.backLink} onClick={() => setSelectedKey(null)}>
              ← Back to week grid
            </button>
            <span className={styles.editingName}>{selectedAssignment.workout_name}</span>
            <div
              className={styles.dayChipRow}
              style={colorVar(colorByWorkout.get(selectedAssignment.workout_id))}
            >
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
                  <div className={styles.weekLabel}>Wk {week}</div>
                  {DAY_VALUES.map((day) => {
                    const assignment = byDay.get(day);
                    return (
                      <div
                        key={day}
                        className={`${styles.dayCell} ${targetDay === day ? styles.targeted : ""} ${dragOverDay === day ? styles.targeted : ""}`}
                        onClick={() => handleCellClick(day)}
                        onDragOver={(e) => {
                          if (!draggedWorkout) return;
                          e.preventDefault();
                          setDragOverDay(day);
                        }}
                        onDragLeave={() => setDragOverDay((d) => (d === day ? null : d))}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedWorkout) onAssignToDay(draggedWorkout, day);
                          setDraggedWorkout(null);
                          setDragOverDay(null);
                          setTargetDay(null);
                        }}
                      >
                        {assignment ? (
                          <div
                            className={`${styles.session} ${selectedKey === assignment.key ? styles.selected : ""}`}
                            style={colorVar(colorByWorkout.get(assignment.workout_id))}
                          >
                            <span className={styles.sessionName}>{assignment.workout_name}</span>
                            {assignment.high_load && (
                              <span className={styles.highLoadBadge} title="Marked high-load">
                                High load
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className={restDays.includes(day) ? styles.rest : styles.plus}>
                            {restDays.includes(day) ? "Rest" : "+"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
  );

  // Opening a day hands that workout's own library up to the same rail the
  // calendar was using, so the rail is always "what can I add right now"
  // and the workout never renders a second shell inside this one.
  if (renderSlots && selectedAssignment) {
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
          {grid}
        </>
      ),
      library: workoutLibrary,
    });
  }

  return (
    <div className={styles.wrapper}>
      {header}
      {selectedAssignment ? (
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
