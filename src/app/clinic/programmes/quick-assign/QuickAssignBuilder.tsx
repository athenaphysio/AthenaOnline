"use client";

import { useEffect, useMemo, useState } from "react";
import PatientPicker, { type Patient } from "../../PatientPicker";
import PickerCanvas, { PickerThumb, PickerResultBody } from "../../builder/PickerCanvas";
import clinicStyles from "../../clinic.module.css";
import { useUnsavedChanges } from "../../useUnsavedChanges";
import styles from "./QuickAssignBuilder.module.css";
import { PRESCRIPTION_DEFAULTS } from "@/lib/prescriptionDefaults";
import { cleanPrescriptionMode, fieldsForMode, type PrescriptionMode } from "@/lib/prescriptionMode";
import PrescriptionModeToggle from "../../builder/PrescriptionModeToggle";

type ExerciseOption = {
  exercise_id: string;
  name_clinical: string;
  body_site: string | null;
  primary_aim: string | null;
  thumbnail_url: string | null;
  default_sets: number | null;
  default_reps: number | null;
  default_hold_seconds: number | null;
  condition_use_case: string | null;
  default_prescription_mode?: string | null;
};

type QuickAssignItem = {
  key: string;
  exercise_id: string;
  exercise_name: string;
  sets: number | null;
  reps: number | null;
  hold_seconds: number | null;
  percent_max: number | null;
  frequency: string | null;
  rationale: string | null;
  prescription_mode: PrescriptionMode;
};

let keyCounter = 0;
function newKey(): string {
  keyCounter += 1;
  return `new-${Date.now()}-${keyCounter}`;
}

type Props = {
  programmeId: string;
  workoutId: string;
  initialPatient?: Patient | null;
};

// The deliberately smaller, faster sibling of the full Programme Builder --
// a handful of standalone exercises straight to a client, standardised
// prescriptions and generic instructions pulled from the exercise library's
// own defaults (never invented here), no calendar, no clinical guide to
// write. Produces the same underlying artifact an Open, Bespoke-built
// programme would (one Workout of standalone exercises + a delivery_mode:
// "open" Programme with a single, unscheduled assignment) -- just through a
// simpler, single-purpose screen.
export default function QuickAssignBuilder({ programmeId, workoutId, initialPatient = null }: Props) {
  const [patient, setPatient] = useState<Patient | null>(initialPatient);
  const [name, setName] = useState("");
  const [items, setItems] = useState<QuickAssignItem[]>([]);

  const [library, setLibrary] = useState<ExerciseOption[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [bodyAreaFilter, setBodyAreaFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const { markSaved } = useUnsavedChanges({ patient, name, items });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/clinic/exercises")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setLibrary(data.exercises ?? []);
      })
      .finally(() => {
        if (!cancelled) setLibraryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const bodyAreaOptions = useMemo(
    () =>
      Array.from(new Set(library.map((e) => e.body_site).filter((v): v is string => Boolean(v)))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [library]
  );
  const typeOptions = useMemo(
    () =>
      Array.from(new Set(library.map((e) => e.primary_aim).filter((v): v is string => Boolean(v)))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [library]
  );

  const filteredExercises = useMemo(() => {
    const q = query.trim().toLowerCase();
    return library
      .filter((e) => (bodyAreaFilter ? e.body_site === bodyAreaFilter : true))
      .filter((e) => (typeFilter ? e.primary_aim === typeFilter : true))
      .filter((e) => (q ? e.name_clinical.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name_clinical.localeCompare(b.name_clinical))
      .slice(0, 60);
  }, [library, bodyAreaFilter, typeFilter, query]);

  function addExercise(exercise: ExerciseOption) {
    setItems((prev) => [
      ...prev,
      {
        key: newKey(),
        exercise_id: exercise.exercise_id,
        exercise_name: exercise.name_clinical,
        // This picker already seeds from each exercise's own curated
        // defaults, which are better than a blanket number where they
        // exist; the shared default only fills what they leave blank.
        sets: exercise.default_sets ?? PRESCRIPTION_DEFAULTS.sets,
        reps: exercise.default_reps ?? PRESCRIPTION_DEFAULTS.reps,
        hold_seconds: exercise.default_hold_seconds ?? PRESCRIPTION_DEFAULTS.hold_seconds,
        percent_max: PRESCRIPTION_DEFAULTS.percent_max,
        frequency: PRESCRIPTION_DEFAULTS.frequency,
        rationale: exercise.condition_use_case,
        prescription_mode: cleanPrescriptionMode(exercise.default_prescription_mode),
      },
    ]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
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

  function updateItem(key: string, patch: Partial<QuickAssignItem>) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  async function handleSend() {
    if (!patient || !name.trim() || items.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const workoutRes = await fetch("/api/clinic/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: workoutId,
          name: name.trim(),
          items: items.map((item, i) => ({
            item_order: i + 1,
            slot_type: "main_body",
            block_id: null,
            exercise_id: item.exercise_id,
            sets: item.sets,
            reps: item.reps,
            hold_seconds: item.hold_seconds,
            percent_max: item.percent_max,
            frequency: item.frequency,
            rationale: item.rationale,
            prescription_mode: item.prescription_mode,
          })),
        }),
      });
      const workoutData = await workoutRes.json();
      if (!workoutRes.ok) throw new Error(workoutData.error || "Couldn't save the routine.");

      const programmeRes = await fetch("/api/clinic/programmes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: programmeId,
          patient_id: patient.id,
          title: name.trim(),
          block_length_weeks: 1,
          audio_url: null,
          delivery_mode: "open",
          assignments: [{ workout_id: workoutId, day_of_week: null }],
          // Always clinician-assigned, never subscription-gated, regardless
          // of the patient's membership status -- Quick Assign is meant to
          // be a free, no-strings gift by design.
          origin: "quick_assign",
        }),
      });
      const programmeData = await programmeRes.json();
      if (!programmeRes.ok) throw new Error(programmeData.error || "Couldn't send.");

      setSent(true);
      markSaved({ patient, name, items });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  if (sent) {
    return (
      <div className={clinicStyles.shareLinkCard}>
        <div className={clinicStyles.smallLabel}>Sent</div>
        <div className={clinicStyles.shareLinkText}>
          &ldquo;{name}&rdquo; is in {patient?.first_name}&apos;s account now — no link to send.
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* A light card, not bare fields on the canvas -- see the matching
          comment in ProgrammeBuilder.tsx. */}
      <div className={clinicStyles.card}>
        <div className={clinicStyles.row2}>
          <PatientPicker selected={patient} onSelect={setPatient} />
          <div className={clinicStyles.field} style={{ marginBottom: 0 }}>
            <label className={clinicStyles.label}>Name this routine</label>
            <input
              className={clinicStyles.input}
              placeholder="e.g. Shoulder maintenance"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
      </div>

      <PickerCanvas<ExerciseOption, QuickAssignItem>
        pickerTitle="Exercise library"
        searchQuery={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search exercises…"
        pickerItems={filteredExercises}
        getPickerItemKey={(e) => e.exercise_id}
        renderPickerItem={(e) => (
          <>
            <PickerThumb src={e.thumbnail_url} label={e.name_clinical} />
            <PickerResultBody name={e.name_clinical} tags={[e.body_site, e.primary_aim]} />
          </>
        )}
        isAdded={(e) => items.some((i) => i.exercise_id === e.exercise_id)}
        onAdd={addExercise}
        pickerEmptyMessage={libraryLoading ? "Loading…" : "No exercises match."}
        pickerExtra={
          <div className={styles.filterRow}>
            <select
              className={styles.filterSelect}
              value={bodyAreaFilter}
              onChange={(e) => setBodyAreaFilter(e.target.value)}
            >
              <option value="">All body areas</option>
              {bodyAreaOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <select className={styles.filterSelect} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All types</option>
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        }
        canvasTitle={`This routine (${items.length} exercise${items.length === 1 ? "" : "s"})`}
        canvasItems={items}
        getCanvasItemKey={(item) => item.key}
        renderCanvasItem={(item) => item.exercise_name}
        onMoveUp={(i) => moveItem(i, -1)}
        onMoveDown={(i) => moveItem(i, 1)}
        onRemove={removeItem}
        canvasEmptyMessage="Add exercises from the left."
        canvasRowExtra={(item) => {
          const { showReps, showHoldAndMax } = fieldsForMode(item.prescription_mode);
          return (
            <div className={styles.fieldGrid}>
              <div className={styles.rationaleField}>
                <div className={styles.fieldLabel}>Prescribed by</div>
                <PrescriptionModeToggle
                  value={item.prescription_mode}
                  onChange={(prescription_mode) => updateItem(item.key, { prescription_mode })}
                />
              </div>
              <div>
                <div className={styles.fieldLabel}>Sets</div>
                <input
                  type="number"
                  className={styles.fieldInput}
                  value={item.sets ?? ""}
                  onChange={(e) => updateItem(item.key, { sets: e.target.value === "" ? null : Number(e.target.value) })}
                />
              </div>
              {showReps && (
                <div>
                  <div className={styles.fieldLabel}>Reps</div>
                  <input
                    type="number"
                    className={styles.fieldInput}
                    value={item.reps ?? ""}
                    onChange={(e) => updateItem(item.key, { reps: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </div>
              )}
              {showHoldAndMax && (
                <>
                  <div>
                    <div className={styles.fieldLabel}>Hold (s)</div>
                    <input
                      type="number"
                      className={styles.fieldInput}
                      value={item.hold_seconds ?? ""}
                      onChange={(e) =>
                        updateItem(item.key, { hold_seconds: e.target.value === "" ? null : Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <div className={styles.fieldLabel}>% max</div>
                    <input
                      type="number"
                      className={styles.fieldInput}
                      value={item.percent_max ?? ""}
                      onChange={(e) =>
                        updateItem(item.key, { percent_max: e.target.value === "" ? null : Number(e.target.value) })
                      }
                    />
                  </div>
                </>
              )}
              <div>
                <div className={styles.fieldLabel}>Frequency</div>
                <input
                  className={styles.fieldInput}
                  value={item.frequency ?? ""}
                  onChange={(e) => updateItem(item.key, { frequency: e.target.value || null })}
                />
              </div>
              <div className={styles.rationaleField}>
                <div className={styles.fieldLabel}>Why (shown to the client)</div>
                <textarea
                  className={styles.rationaleInput}
                  value={item.rationale ?? ""}
                  onChange={(e) => updateItem(item.key, { rationale: e.target.value || null })}
                />
              </div>
            </div>
          );
        }}
      />

      {error && (
        <div className={clinicStyles.error} style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      <button
        type="button"
        className={clinicStyles.button}
        style={{ marginTop: 20 }}
        disabled={saving || !patient || !name.trim() || items.length === 0}
        onClick={handleSend}
      >
        {saving ? "Sending…" : "Send"}
      </button>
    </div>
  );
}
