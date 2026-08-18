"use client";

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
};

// The prescription card for one week, shown for whichever week is selected
// via WeekTabs -- shared by BlockBuilder (the standalone Block library
// editor) and BlockGroupEditor.tsx (a block expanded inline inside the
// Workout Builder), same markup, same fields, one place to change.
export default function WeekGrid({ week: w, exerciseLibrary, onChangeExercise, onChangeField, onChangeNumeric }: Props) {
  const mode = w.prescription_mode;
  const { showReps, showHoldAndMax } = fieldsForMode(mode);

  function setMode(next: PrescriptionMode) {
    onChangeField(w.week_number, { prescription_mode: next });
  }

  return (
    <div className={styles.card}>
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
      </div>

      <div className={styles.field}>
        <div className={styles.fieldLabel}>Frequency</div>
        <input
          className={styles.input}
          value={w.frequency ?? ""}
          onChange={(e) => onChangeField(w.week_number, { frequency: e.target.value || null })}
        />
      </div>

      <div>
        <div className={styles.fieldLabel}>Rationale</div>
        <textarea
          className={styles.textarea}
          value={w.rationale}
          onChange={(e) => onChangeField(w.week_number, { rationale: e.target.value })}
        />
      </div>
    </div>
  );
}
