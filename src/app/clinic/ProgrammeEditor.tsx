"use client";

import { useState } from "react";
import styles from "./clinic.module.css";
import AudioRecorder from "./AudioRecorder";

export type EditorWeek = {
  week_number: number;
  sets: number | null;
  reps: number | null;
  hold_seconds: number | null;
  frequency: string | null;
};

export type EditorExercise = {
  key: string;
  exercise_id: string;
  name: string;
  rationale: string;
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

type FillDraft = { sets: string; reps: string; hold_seconds: string; frequency: string };
const emptyFillDraft: FillDraft = { sets: "", reps: "", hold_seconds: "", frequency: "" };

type Props = {
  mode: "create" | "edit";
  programmeId: string;
  shareCode: string | null;
  initialPatientFirstName: string;
  initialTitle: string;
  initialBlockLengthWeeks: number;
  initialExercises: EditorExercise[];
  initialAudioUrl: string | null;
  aiDraft: AiDraftReference | null;
  exerciseLibrary: LibraryExerciseOption[];
};

function emptyWeek(n: number): EditorWeek {
  return { week_number: n, sets: null, reps: null, hold_seconds: null, frequency: null };
}

function resizeWeeks(weeks: EditorWeek[], newLength: number): EditorWeek[] {
  if (newLength === weeks.length) return weeks;
  if (newLength < weeks.length) return weeks.slice(0, newLength);
  const last = weeks[weeks.length - 1];
  const extra: EditorWeek[] = [];
  for (let n = weeks.length + 1; n <= newLength; n++) {
    extra.push(last ? { ...last, week_number: n } : emptyWeek(n));
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
  initialExercises,
  initialAudioUrl,
  aiDraft,
  exerciseLibrary,
}: Props) {
  const [patientFirstName, setPatientFirstName] = useState(initialPatientFirstName);
  const [title, setTitle] = useState(initialTitle);
  const [blockLengthWeeks, setBlockLengthWeeks] = useState(initialBlockLengthWeeks);
  const [exercises, setExercises] = useState<EditorExercise[]>(initialExercises);
  const [audioUrl, setAudioUrl] = useState<string | null>(initialAudioUrl);
  const [shareCode, setShareCode] = useState<string | null>(initialShareCode);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fillDrafts, setFillDrafts] = useState<Record<string, FillDraft>>({});

  function updateBlockLength(n: number) {
    const clamped = Math.max(1, Math.min(12, n));
    setBlockLengthWeeks(clamped);
    setExercises((prev) => prev.map((ex) => ({ ...ex, weeks: resizeWeeks(ex.weeks, clamped) })));
  }

  function updateCell(exKey: string, weekNumber: number, field: keyof EditorWeek, value: string) {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.key !== exKey) return ex;
        return {
          ...ex,
          weeks: ex.weeks.map((w) => {
            if (w.week_number !== weekNumber) return w;
            if (field === "frequency") return { ...w, frequency: value || null };
            if (field === "week_number") return w;
            const num = value === "" ? null : Number(value);
            return { ...w, [field]: num === null || Number.isNaN(num) ? null : num };
          }),
        };
      })
    );
  }

  function updateRationale(exKey: string, value: string) {
    setExercises((prev) => prev.map((ex) => (ex.key === exKey ? { ...ex, rationale: value } : ex)));
  }

  function removeExercise(exKey: string) {
    setExercises((prev) => prev.filter((ex) => ex.key !== exKey));
  }

  function moveExercise(exKey: string, direction: -1 | 1) {
    setExercises((prev) => {
      const idx = prev.findIndex((ex) => ex.key === exKey);
      const target = idx + direction;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function addExercise(opt: LibraryExerciseOption) {
    setExercises((prev) => [
      ...prev,
      {
        key: newKey(),
        exercise_id: opt.exercise_id,
        name: opt.name_clinical,
        rationale: "",
        weeks: Array.from({ length: blockLengthWeeks }, (_, i) => emptyWeek(i + 1)),
      },
    ]);
    setPickerOpen(false);
    setPickerQuery("");
  }

  function setFillField(exKey: string, field: keyof FillDraft, value: string) {
    setFillDrafts((prev) => ({ ...prev, [exKey]: { ...(prev[exKey] ?? emptyFillDraft), [field]: value } }));
  }

  function applyFillToRow(exKey: string) {
    const draft = fillDrafts[exKey] ?? emptyFillDraft;
    const sets = draft.sets === "" ? null : Number(draft.sets);
    const reps = draft.reps === "" ? null : Number(draft.reps);
    const hold_seconds = draft.hold_seconds === "" ? null : Number(draft.hold_seconds);
    const frequency = draft.frequency || null;
    setExercises((prev) =>
      prev.map((ex) =>
        ex.key === exKey
          ? { ...ex, weeks: ex.weeks.map((w) => ({ ...w, sets, reps, hold_seconds, frequency })) }
          : ex
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
        items: exercises.map((ex, i) => ({
          exercise_id: ex.exercise_id,
          item_order: i + 1,
          rationale: ex.rationale,
          weeks: ex.weeks,
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

  const addedIds = new Set(exercises.map((e) => e.exercise_id));
  const filteredLibrary = exerciseLibrary.filter((e) => {
    if (addedIds.has(e.exercise_id)) return false;
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return true;
    return e.exercise_id.toLowerCase().includes(q) || e.name_clinical.toLowerCase().includes(q);
  });

  const weekNumbers = Array.from({ length: blockLengthWeeks }, (_, i) => i + 1);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

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
              <th className={styles.rowHeaderCell}>Exercise</th>
              {weekNumbers.map((n) => (
                <th key={n}>Week {n}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {exercises.map((ex, idx) => (
              <tr key={ex.key}>
                <td className={styles.rowHeaderCell}>
                  <div style={{ fontWeight: 500 }}>{ex.name}</div>
                  <div className={styles.exerciseId}>{ex.exercise_id}</div>
                  <textarea
                    className={styles.textarea}
                    style={{ minHeight: 60, fontFamily: "inherit", fontSize: 12.5, marginTop: 8 }}
                    value={ex.rationale}
                    onChange={(e) => updateRationale(ex.key, e.target.value)}
                    placeholder="Rationale for the patient…"
                  />
                  <div className={styles.fillRow}>
                    <div>
                      <div className={styles.cellFieldLabel}>Sets</div>
                      <input
                        type="number"
                        className={styles.smallInput}
                        value={fillDrafts[ex.key]?.sets ?? ""}
                        onChange={(e) => setFillField(ex.key, "sets", e.target.value)}
                      />
                    </div>
                    <div>
                      <div className={styles.cellFieldLabel}>Reps</div>
                      <input
                        type="number"
                        className={styles.smallInput}
                        value={fillDrafts[ex.key]?.reps ?? ""}
                        onChange={(e) => setFillField(ex.key, "reps", e.target.value)}
                      />
                    </div>
                    <div>
                      <div className={styles.cellFieldLabel}>Hold (s)</div>
                      <input
                        type="number"
                        className={styles.smallInput}
                        value={fillDrafts[ex.key]?.hold_seconds ?? ""}
                        onChange={(e) => setFillField(ex.key, "hold_seconds", e.target.value)}
                      />
                    </div>
                    <div>
                      <div className={styles.cellFieldLabel}>Frequency</div>
                      <input
                        className={styles.smallInput}
                        value={fillDrafts[ex.key]?.frequency ?? ""}
                        onChange={(e) => setFillField(ex.key, "frequency", e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => applyFillToRow(ex.key)}
                    >
                      Fill all weeks
                    </button>
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => moveExercise(ex.key, -1)}
                      disabled={idx === 0}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => moveExercise(ex.key, 1)}
                      disabled={idx === exercises.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className={styles.iconButtonDanger}
                      onClick={() => removeExercise(ex.key)}
                    >
                      Remove
                    </button>
                  </div>
                </td>
                {ex.weeks.map((w) => (
                  <td key={w.week_number} className={styles.weekCell}>
                    <div className={styles.cellInputs}>
                      <div>
                        <div className={styles.cellFieldLabel}>Sets</div>
                        <input
                          type="number"
                          className={styles.smallInput}
                          value={w.sets ?? ""}
                          onChange={(e) => updateCell(ex.key, w.week_number, "sets", e.target.value)}
                        />
                      </div>
                      <div>
                        <div className={styles.cellFieldLabel}>Reps</div>
                        <input
                          type="number"
                          className={styles.smallInput}
                          value={w.reps ?? ""}
                          onChange={(e) => updateCell(ex.key, w.week_number, "reps", e.target.value)}
                        />
                      </div>
                      <div>
                        <div className={styles.cellFieldLabel}>Hold (s)</div>
                        <input
                          type="number"
                          className={styles.smallInput}
                          value={w.hold_seconds ?? ""}
                          onChange={(e) =>
                            updateCell(ex.key, w.week_number, "hold_seconds", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <div className={styles.cellFieldLabel}>Frequency</div>
                        <input
                          className={styles.smallInput}
                          value={w.frequency ?? ""}
                          onChange={(e) =>
                            updateCell(ex.key, w.week_number, "frequency", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginBottom: 20 }}>
        <button
          type="button"
          className={styles.buttonSecondary}
          onClick={() => setPickerOpen((v) => !v)}
        >
          + Add exercise
        </button>
        {pickerOpen && (
          <>
            <input
              className={styles.input}
              style={{ marginTop: 10 }}
              placeholder="Search exercises…"
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              autoFocus
            />
            <div className={styles.pickerResults}>
              {filteredLibrary.slice(0, 50).map((opt) => (
                <button
                  key={opt.exercise_id}
                  type="button"
                  className={styles.pickerRow}
                  onClick={() => addExercise(opt)}
                >
                  {opt.name_clinical} <span className={styles.exerciseId}>{opt.exercise_id}</span>
                </button>
              ))}
            </div>
          </>
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
