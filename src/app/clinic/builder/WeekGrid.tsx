"use client";

import { useState } from "react";
import type { EditorWeek, LibraryExerciseOption } from "@/lib/blockItemsEditor";
import { fieldsForMode, type PrescriptionMode } from "@/lib/prescriptionMode";
import PrescriptionModeToggle from "./PrescriptionModeToggle";
import styles from "./WeekGrid.module.css";

type Props = {
  week: EditorWeek;
  exerciseLibrary: LibraryExerciseOption[];
  onChangeExercise: (weekNumber: number, exerciseId: string) => void;
  onChangeField: (weekNumber: number, patch: Partial<EditorWeek>) => void;
  onChangeNumeric: (
    weekNumber: number,
    field: "sets" | "reps" | "hold_seconds" | "percent_max",
    value: string
  ) => void;
  /** The Workout/Programme builder's inline block view, where many
   * exercises need to fit on screen at once: no exercise swap-in-place
   * dropdown (the name is already in the crimson header above -- remove
   * this card and add the replacement from the library instead), Sets/
   * Reps/Frequency share one row, and Rationale starts collapsed. */
  compact?: boolean;
};

// The prescription card for one week, shown for whichever week is selected
// via WeekTabs -- shared by BlockBuilder (the standalone Block library
// editor) and BlockGroupEditor.tsx (a block expanded inline inside the
// Workout Builder), same markup, same fields, one place to change.
export default function WeekGrid({
  week: w,
  exerciseLibrary,
  onChangeExercise,
  onChangeField,
  onChangeNumeric,
  compact = false,
}: Props) {
  const mode = w.prescription_mode;
  const { showReps, showHoldAndMax } = fieldsForMode(mode);
  const [rationaleOpen, setRationaleOpen] = useState(false);

  function setMode(next: PrescriptionMode) {
    onChangeField(w.week_number, { prescription_mode: next });
  }

  return (
    <div className={styles.card}>
      {!compact && (
        <div className={styles.field}>
          <div className={styles.fieldLabel}>Exercise</div>
          <select
            className={styles.input}
            value={w.exercise_id}
            onChange={(e) => onChangeExercise(w.week_number, e.target.value)}
          >
            {exerciseLibrary.map((opt) => (
              <option key={opt.exercise_id} value={opt.exercise_id}>
                {opt.name_clinical}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Isometric holds don't fit a rep count -- this switches which of
          Reps or Hold (s)/% max is shown and written, rather than leaving
          both visible and asking David to remember which one to ignore. */}
      <div className={styles.field}>
        <div className={styles.fieldLabel}>Prescribed by</div>
        <PrescriptionModeToggle value={mode} onChange={setMode} />
      </div>

      <div className={`${styles.numberRow} ${styles.field}`}>
        <div>
          <div className={styles.fieldLabel}>Sets</div>
          <input
            type="number"
            className={styles.input}
            value={w.sets ?? ""}
            onChange={(e) => onChangeNumeric(w.week_number, "sets", e.target.value)}
          />
        </div>
        {showReps && (
          <div>
            <div className={styles.fieldLabel}>Reps</div>
            <input
              type="number"
              className={styles.input}
              value={w.reps ?? ""}
              onChange={(e) => onChangeNumeric(w.week_number, "reps", e.target.value)}
            />
          </div>
        )}
        {showHoldAndMax && (
          <>
            <div>
              <div className={styles.fieldLabel}>Hold (s)</div>
              <input
                type="number"
                className={styles.input}
                value={w.hold_seconds ?? ""}
                onChange={(e) => onChangeNumeric(w.week_number, "hold_seconds", e.target.value)}
              />
            </div>
            <div>
              <div className={styles.fieldLabel}>% max</div>
              <input
                type="number"
                className={styles.input}
                value={w.percent_max ?? ""}
                onChange={(e) => onChangeNumeric(w.week_number, "percent_max", e.target.value)}
              />
            </div>
          </>
        )}
        {compact && (
          <div>
            <div className={styles.fieldLabel}>Frequency</div>
            <input
              className={styles.input}
              value={w.frequency ?? ""}
              onChange={(e) => onChangeField(w.week_number, { frequency: e.target.value || null })}
            />
          </div>
        )}
      </div>

      {!compact && (
        <div className={styles.field}>
          <div className={styles.fieldLabel}>Frequency</div>
          <input
            className={styles.input}
            value={w.frequency ?? ""}
            onChange={(e) => onChangeField(w.week_number, { frequency: e.target.value || null })}
          />
        </div>
      )}

      {compact ? (
        <div>
          {rationaleOpen ? (
            <>
              <div className={styles.fieldLabel}>Rationale</div>
              <textarea
                className={styles.textarea}
                value={w.rationale}
                onChange={(e) => onChangeField(w.week_number, { rationale: e.target.value })}
                autoFocus
              />
            </>
          ) : (
            <button type="button" className={styles.rationaleToggle} onClick={() => setRationaleOpen(true)}>
              {w.rationale?.trim() ? "Rationale ✓, tap to edit" : "+ Add rationale"}
            </button>
          )}
        </div>
      ) : (
        <div>
          <div className={styles.fieldLabel}>Rationale</div>
          <textarea
            className={styles.textarea}
            value={w.rationale}
            onChange={(e) => onChangeField(w.week_number, { rationale: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
