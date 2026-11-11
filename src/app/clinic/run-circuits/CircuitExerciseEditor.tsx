"use client";

import { useMemo, useState } from "react";
import { CIRCUIT_DOSE_TYPES, DOSE_LABEL, type CircuitDoseType, type CircuitExercise } from "@/lib/runCircuit";
import clinicStyles from "../clinic.module.css";

export type ExerciseChoice = { exercise_id: string; name_clinical: string | null };

type Props = {
  exercises: CircuitExercise[];
  library: ExerciseChoice[];
  onChange: (next: CircuitExercise[]) => void;
};

const smallButton: React.CSSProperties = {
  border: "1px solid var(--mist)",
  background: "var(--clinic-box, #fff)",
  borderRadius: 7,
  padding: "4px 9px",
  fontSize: 12.5,
  cursor: "pointer",
};

// The exercises inside one circuit block, in order, each with its own dose.
// Used by the Run Circuit library and by a client's Run Circuit card in the
// programme builder, where the same edits stay with that client only.
export default function CircuitExerciseEditor({ exercises, library, onChange }: Props) {
  const [search, setSearch] = useState("");

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return library
      .filter((e) => (e.name_clinical ?? "").toLowerCase().includes(q) || e.exercise_id.toLowerCase().includes(q))
      .slice(0, 12);
  }, [search, library]);

  function update(i: number, patch: Partial<CircuitExercise>) {
    onChange(exercises.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }

  function move(i: number, by: number) {
    const j = i + by;
    if (j < 0 || j >= exercises.length) return;
    const next = [...exercises];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  function add(choice: ExerciseChoice) {
    onChange([
      ...exercises,
      { exercise_id: choice.exercise_id, name: choice.name_clinical ?? choice.exercise_id, dose_type: "reps", amount: 10, per_side: false, note: "" },
    ]);
    setSearch("");
  }

  return (
    <div>
      {exercises.length === 0 && <p className={clinicStyles.notice}>No exercises in this block yet.</p>}
      {exercises.map((ex, i) => (
        <div
          key={`${ex.exercise_id}-${i}`}
          style={{ border: "1px solid var(--mist)", borderRadius: 9, padding: "10px 12px", marginBottom: 8, background: "var(--clinic-box, #fff)" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {i + 1}. {ex.name || ex.exercise_id}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" style={smallButton} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                &uarr;
              </button>
              <button type="button" style={smallButton} onClick={() => move(i, 1)} disabled={i === exercises.length - 1} aria-label="Move down">
                &darr;
              </button>
              <button type="button" style={smallButton} onClick={() => onChange(exercises.filter((_, idx) => idx !== i))} aria-label="Remove exercise">
                &times;
              </button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="number"
              min={1}
              max={3600}
              className={clinicStyles.smallInput}
              style={{ width: 80 }}
              value={ex.amount}
              onChange={(e) => update(i, { amount: Math.max(1, Number(e.target.value) || 1) })}
              aria-label="Amount"
            />
            <select
              className={clinicStyles.smallInput}
              value={ex.dose_type}
              onChange={(e) => update(i, { dose_type: e.target.value as CircuitDoseType })}
              aria-label="Dose type"
            >
              {CIRCUIT_DOSE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DOSE_LABEL[t]}
                </option>
              ))}
            </select>
            <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>
              <input type="checkbox" checked={ex.per_side} onChange={(e) => update(i, { per_side: e.target.checked })} />
              each side
            </label>
          </div>
          <input
            className={clinicStyles.input}
            style={{ marginTop: 8 }}
            placeholder="Coaching note (optional)"
            value={ex.note}
            onChange={(e) => update(i, { note: e.target.value })}
          />
        </div>
      ))}

      <input
        className={clinicStyles.input}
        placeholder="Add an exercise: type part of its name"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {results.length > 0 && (
        <div className={clinicStyles.pickerResults}>
          {results.map((r) => (
            <button key={r.exercise_id} type="button" className={clinicStyles.pickerRow} onClick={() => add(r)}>
              {r.name_clinical ?? r.exercise_id} <span style={{ color: "var(--muted)", fontSize: 12 }}>{r.exercise_id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
