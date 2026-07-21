"use client";

import { useState } from "react";
import styles from "./clinic.module.css";
import AudioRecorder from "./AudioRecorder";

export type EditorWeek = {
  week_number: number;
  exercise_id: string;
  name: string;
  rationale: string;
  sets: number | null;
  reps: number | null;
  hold_seconds: number | null;
  percent_max: number | null;
  frequency: string | null;
};

export type EditorSlot = {
  key: string;
  weeks: EditorWeek[];
};

export type LibraryExerciseOption = {
  exercise_id: string;
  name_clinical: string;
};

export type AiDraftReference = {
  block: string;
  assumptions: string[];
  confirmations: string[];
  created_at: string;
};

type FillDraft = {
  exercise_id: string;
  sets: string;
  reps: string;
  hold_seconds: string;
  percent_max: string;
  frequency: string;
  rationale: string;
};

const emptyFillDraft: FillDraft = {
  exercise_id: "",
  sets: "",
  reps: "",
  hold_seconds: "",
  percent_max: "",
  frequency: "",
  rationale: "",
};

type Props = {
  mode: "create" | "edit";
  programmeId: string;
  shareCode: string | null;
  initialPatientFirstName: string;
  initialTitle: string;
  initialBlockLengthWeeks: number;
  initialSlots: EditorSlot[];
  initialAudioUrl: string | null;
  aiDraft: AiDraftReference | null;
  exerciseLibrary: LibraryExerciseOption[];
};

function resizeWeeks(weeks: EditorWeek[], newLength: number): EditorWeek[] {
  if (newLength === weeks.length) return weeks;
  if (newLength < weeks.length) return weeks.slice(0, newLength);
  const last = weeks[weeks.length - 1];
  const extra: EditorWeek[] = [];
  for (let n = weeks.length + 1; n <= newLength; n++) {
    extra.push({ ...last, week_number: n });
  }
  return [...weeks, ...extra];
}

let keyCounter = 0;
function newKey(): string {
  keyCounter += 1;
  return `new-${Date.now()}-${keyCounter}`;
}

export default function ProgrammeEditor({
  mode,
  programmeId,
  shareCode: initialShareCode,
  initialPatientFirstName,
  initialTitle,
  initialBlockLengthWeeks,
  initialSlots,
  initialAudioUrl,
  aiDraft,
  exerciseLibrary,
}: Props) {
  const [patientFirstName, setPatientFirstName] = useState(initialPatientFirstName);
  const [title, setTitle] = useState(initialTitle);
  const [blockLengthWeeks, setBlockLengthWeeks] = useState(initialBlockLengthWeeks);
  const [slots, setSlots] = useState<EditorSlot[]>(initialSlots);
  const [audioUrl, setAudioUrl] = useState<string | null>(initialAudioUrl);
  const [shareCode, setShareCode] = useState<string | null>(initialShareCode);
  const [addingSlot, setAddingSlot] = useState(false);
  const [newSlotExerciseId, setNewSlotExerciseId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fillDrafts, setFillDrafts] = useState<Record<string, FillDraft>>({});

  const libraryById = new Map(exerciseLibrary.map((e) => [e.exercise_id, e]));

  function updateBlockLength(n: number) {
    const clamped = Math.max(1, Math.min(12, n));
    setBlockLengthWeeks(clamped);
    setSlots((prev) => prev.map((slot) => ({ ...slot, weeks: resizeWeeks(slot.weeks, clamped) })));
  }

  function updateWeekField(slotKey: string, weekNumber: number, patch: Partial<EditorWeek>) {
    setSlots((prev) =>
      prev.map((slot) => {
        if (slot.key !== slotKey) return slot;
        return {
          ...slot,
          weeks: slot.weeks.map((w) => (w.week_number === weekNumber ? { ...w, ...patch } : w)),
        };
      })
    );
  }

  function changeCellExercise(slotKey: string, weekNumber: number, exerciseId: string) {
    const opt = libraryById.get(exerciseId);
    if (!opt) return;
    updateWeekField(slotKey, weekNumber, { exercise_id: exerciseId, name: opt.name_clinical });
  }

  function updateNumericField(
    slotKey: string,
    weekNumber: number,
    field: "sets" | "reps" | "hold_seconds" | "percent_max",
    value: string
  ) {
    const num = value === "" ? null : Number(value);
    updateWeekField(slotKey, weekNumber, { [field]: num === null || Number.isNaN(num) ? null : num });
  }

  function updateFrequency(slotKey: string, weekNumber: number, value: string) {
    updateWeekField(slotKey, weekNumber, { frequency: value || null });
  }

  function updateRationale(slotKey: string, weekNumber: number, value: string) {
    updateWeekField(slotKey, weekNumber, { rationale: value });
  }

  function removeSlot(slotKey: string) {
    setSlots((prev) => prev.filter((s) => s.key !== slotKey));
  }

  function moveSlot(slotKey: string, direction: -1 | 1) {
    setSlots((prev) => {
      const idx = prev.findIndex((s) => s.key === slotKey);
      const target = idx + direction;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function addSlot() {
    const opt = libraryById.get(newSlotExerciseId);
    if (!opt) return;
    setSlots((prev) => [
      ...prev,
      {
        key: newKey(),
        weeks: Array.from({ length: blockLengthWeeks }, (_, i) => ({
          week_number: i + 1,
          exercise_id: opt.exercise_id,
          name: opt.name_clinical,
          rationale: "",
          sets: null,
          reps: null,
          hold_seconds: null,
          percent_max: null,
          frequency: null,
        })),
      },
    ]);
    setAddingSlot(false);
    setNewSlotExerciseId("");
  }

  function setFillField(slotKey: string, field: keyof FillDraft, value: string) {
    setFillDrafts((prev) => ({ ...prev, [slotKey]: { ...(prev[slotKey] ?? emptyFillDraft), [field]: value } }));
  }

  function applyFillToRow(slotKey: string) {
    const draft = fillDrafts[slotKey] ?? emptyFillDraft;
    const opt = draft.exercise_id ? libraryById.get(draft.exercise_id) : null;
    const sets = draft.sets === "" ? null : Number(draft.sets);
    const reps = draft.reps === "" ? null : Number(draft.reps);
    const hold_seconds = draft.hold_seconds === "" ? null : Number(draft.hold_seconds);
    const percent_max = draft.percent_max === "" ? null : Number(draft.percent_max);
    const frequency = draft.frequency || null;
    setSlots((prev) =>
      prev.map((slot) =>
        slot.key === slotKey
          ? {
              ...slot,
              weeks: slot.weeks.map((w) => ({
                ...w,
                ...(opt ? { exercise_id: opt.exercise_id, name: opt.name_clinical } : {}),
                sets,
                reps,
                hold_seconds,
                percent_max,
                frequency,
                rationale: draft.rationale || w.rationale,
              })),
            }
          : slot
      )
    );
  }

  async function uploadAudio(blob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append("programme_id", programmeId);
    formData.append("audio", blob, "recording.webm");
    const res = await fetch("/api/clinic/audio/programme", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed.");
    setAudioUrl(data.url);
    return data.url;
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        id: programmeId,
        patient_first_name: patientFirstName,
        title,
        block_length_weeks: blockLengthWeeks,
        audio_url: audioUrl,
        items: slots.map((slot, i) => ({
          item_order: i + 1,
          weeks: slot.weeks.map((w) => ({
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

      const res = await fetch(
        mode === "create" ? "/api/clinic/programmes" : `/api/clinic/programmes/${programmeId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      setShareCode(data.share_code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const weekNumbers = Array.from({ length: blockLengthWeeks }, (_, i) => i + 1);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const sortedLibrary = [...exerciseLibrary].sort((a, b) => a.name_clinical.localeCompare(b.name_clinical));

  return (
    <div>
      <div className={styles.row2}>
        <div className={styles.field}>
          <label className={styles.label}>Patient&apos;s first name</label>
          <input
            className={styles.input}
            value={patientFirstName}
            onChange={(e) => setPatientFirstName(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Block length (weeks)</label>
          <input
            type="number"
            min={1}
            max={12}
            className={styles.input}
            value={blockLengthWeeks}
            onChange={(e) => updateBlockLength(Number(e.target.value) || 1)}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Intro line</label>
        <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Programme message</div>
        <AudioRecorder existingUrl={audioUrl} onUpload={uploadAudio} />
      </div>

      {aiDraft && (
        <div className={styles.draftRefCard}>
          <div className={styles.draftRefTitle}>
            Original AI draft — {new Date(aiDraft.created_at).toLocaleString()}
          </div>
          <p style={{ fontSize: 13.5, color: "var(--stone)", marginBottom: 10 }}>{aiDraft.block}</p>
          <div className={styles.smallLabel}>Assumptions made</div>
          <ul className={styles.list}>
            {aiDraft.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
          <div className={styles.smallLabel}>What only you can confirm</div>
          <ul className={styles.list}>
            {aiDraft.confirmations.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.gridScroll}>
        <table className={styles.gridTable}>
          <thead>
            <tr>
              <th className={styles.rowHeaderCell}>Slot</th>
              {weekNumbers.map((n) => (
                <th key={n}>Week {n}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((slot, idx) => {
              const fill = fillDrafts[slot.key] ?? emptyFillDraft;
              return (
                <tr key={slot.key}>
                  <td className={styles.rowHeaderCell}>
                    <div className={styles.smallLabel}>Slot {idx + 1}</div>
                    <div className={styles.fillRow} style={{ flexDirection: "column", alignItems: "stretch" }}>
                      <div className={styles.cellFieldLabel}>Fill every week with:</div>
                      <select
                        className={styles.smallInput}
                        value={fill.exercise_id}
                        onChange={(e) => setFillField(slot.key, "exercise_id", e.target.value)}
                      >
                        <option value="">(keep existing exercise)</option>
                        {sortedLibrary.map((opt) => (
                          <option key={opt.exercise_id} value={opt.exercise_id}>
                            {opt.name_clinical} ({opt.exercise_id})
                          </option>
                        ))}
                      </select>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          type="number"
                          placeholder="Sets"
                          className={styles.smallInput}
                          value={fill.sets}
                          onChange={(e) => setFillField(slot.key, "sets", e.target.value)}
                        />
                        <input
                          type="number"
                          placeholder="Reps"
                          className={styles.smallInput}
                          value={fill.reps}
                          onChange={(e) => setFillField(slot.key, "reps", e.target.value)}
                        />
                        <input
                          type="number"
                          placeholder="Hold (s)"
                          className={styles.smallInput}
                          value={fill.hold_seconds}
                          onChange={(e) => setFillField(slot.key, "hold_seconds", e.target.value)}
                        />
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          type="number"
                          placeholder="% max"
                          className={styles.smallInput}
                          value={fill.percent_max}
                          onChange={(e) => setFillField(slot.key, "percent_max", e.target.value)}
                        />
                        <input
                          placeholder="Frequency"
                          className={styles.smallInput}
                          value={fill.frequency}
                          onChange={(e) => setFillField(slot.key, "frequency", e.target.value)}
                        />
                      </div>
                      <textarea
                        placeholder="Rationale (optional)"
                        className={styles.textarea}
                        style={{ minHeight: 44, fontFamily: "inherit", fontSize: 12 }}
                        value={fill.rationale}
                        onChange={(e) => setFillField(slot.key, "rationale", e.target.value)}
                      />
                      <button type="button" className={styles.iconButton} onClick={() => applyFillToRow(slot.key)}>
                        Fill all weeks
                      </button>
                    </div>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.iconButton}
                        onClick={() => moveSlot(slot.key, -1)}
                        disabled={idx === 0}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className={styles.iconButton}
                        onClick={() => moveSlot(slot.key, 1)}
                        disabled={idx === slots.length - 1}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className={styles.iconButtonDanger}
                        onClick={() => removeSlot(slot.key)}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                  {slot.weeks.map((w) => (
                    <td key={w.week_number} className={styles.weekCell}>
                      <div className={styles.cellInputs}>
                        <div>
                          <div className={styles.cellFieldLabel}>Exercise</div>
                          <select
                            className={styles.smallInput}
                            value={w.exercise_id}
                            onChange={(e) => changeCellExercise(slot.key, w.week_number, e.target.value)}
                          >
                            {sortedLibrary.map((opt) => (
                              <option key={opt.exercise_id} value={opt.exercise_id}>
                                {opt.name_clinical} ({opt.exercise_id})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div className={styles.cellFieldLabel}>Sets</div>
                          <input
                            type="number"
                            className={styles.smallInput}
                            value={w.sets ?? ""}
                            onChange={(e) => updateNumericField(slot.key, w.week_number, "sets", e.target.value)}
                          />
                        </div>
                        <div>
                          <div className={styles.cellFieldLabel}>Reps</div>
                          <input
                            type="number"
                            className={styles.smallInput}
                            value={w.reps ?? ""}
                            onChange={(e) => updateNumericField(slot.key, w.week_number, "reps", e.target.value)}
                          />
                        </div>
                        <div>
                          <div className={styles.cellFieldLabel}>Hold (s)</div>
                          <input
                            type="number"
                            className={styles.smallInput}
                            value={w.hold_seconds ?? ""}
                            onChange={(e) =>
                              updateNumericField(slot.key, w.week_number, "hold_seconds", e.target.value)
                            }
                          />
                        </div>
                        <div>
                          <div className={styles.cellFieldLabel}>% max</div>
                          <input
                            type="number"
                            className={styles.smallInput}
                            value={w.percent_max ?? ""}
                            onChange={(e) =>
                              updateNumericField(slot.key, w.week_number, "percent_max", e.target.value)
                            }
                          />
                        </div>
                        <div>
                          <div className={styles.cellFieldLabel}>Frequency</div>
                          <input
                            className={styles.smallInput}
                            value={w.frequency ?? ""}
                            onChange={(e) => updateFrequency(slot.key, w.week_number, e.target.value)}
                          />
                        </div>
                        <div>
                          <div className={styles.cellFieldLabel}>Rationale</div>
                          <textarea
                            className={styles.textarea}
                            style={{ minHeight: 50, fontFamily: "inherit", fontSize: 12 }}
                            value={w.rationale}
                            onChange={(e) => updateRationale(slot.key, w.week_number, e.target.value)}
                          />
                        </div>
                      </div>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginBottom: 20 }}>
        <button type="button" className={styles.buttonSecondary} onClick={() => setAddingSlot((v) => !v)}>
          + Add exercise slot
        </button>
        {addingSlot && (
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <select
              className={styles.input}
              value={newSlotExerciseId}
              onChange={(e) => setNewSlotExerciseId(e.target.value)}
            >
              <option value="">Choose an exercise…</option>
              {sortedLibrary.map((opt) => (
                <option key={opt.exercise_id} value={opt.exercise_id}>
                  {opt.name_clinical} ({opt.exercise_id})
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.button}
              style={{ width: 120 }}
              disabled={!newSlotExerciseId}
              onClick={addSlot}
            >
              Add
            </button>
          </div>
        )}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <button type="button" className={styles.button} disabled={saving} onClick={handleSubmit}>
        {saving ? "Saving…" : shareCode ? "Save changes" : "Send"}
      </button>

      {shareCode && (
        <div className={styles.shareLinkCard}>
          <div className={styles.smallLabel}>Patient link</div>
          <div className={styles.shareLinkText}>
            {origin}/p/{shareCode}
          </div>
        </div>
      )}
    </div>
  );
}
