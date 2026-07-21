"use client";

import { useState } from "react";
import styles from "../clinic.module.css";
import AudioRecorder from "../AudioRecorder";

export type ExerciseRow = {
  exercise_id: string;
  name_clinical: string;
  audio_url: string | null;
};

export default function ExerciseAudioList({ exercises }: { exercises: ExerciseRow[] }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string | null>>(
    Object.fromEntries(exercises.map((e) => [e.exercise_id, e.audio_url]))
  );

  const filtered = exercises.filter((e) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return e.exercise_id.toLowerCase().includes(q) || e.name_clinical.toLowerCase().includes(q);
  });

  async function upload(exerciseId: string, blob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append("exercise_id", exerciseId);
    formData.append("audio", blob, "recording.webm");
    const res = await fetch("/api/clinic/audio/exercise", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed.");
    setAudioUrls((prev) => ({ ...prev, [exerciseId]: data.url }));
    return data.url;
  }

  return (
    <>
      <div className={styles.field}>
        <input
          className={styles.input}
          placeholder="Search exercises…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.map((ex) => {
        const isOpen = openId === ex.exercise_id;
        const hasAudio = Boolean(audioUrls[ex.exercise_id]);
        return (
          <div key={ex.exercise_id} className={styles.card}>
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : ex.exercise_id)}
              style={{
                width: "100%",
                textAlign: "left",
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 0,
                font: "inherit",
                color: "inherit",
              }}
            >
              <span className={styles.cardTitle} style={{ margin: 0 }}>
                {ex.name_clinical}
                <span className={styles.exerciseId}>{ex.exercise_id}</span>
              </span>
              <span style={{ fontSize: 12.5, color: hasAudio ? "var(--crimson)" : "var(--muted)" }}>
                {hasAudio ? "Recorded" : "No recording"}
              </span>
            </button>

            {isOpen && (
              <div style={{ marginTop: 14 }}>
                <AudioRecorder
                  existingUrl={audioUrls[ex.exercise_id]}
                  onUpload={(blob) => upload(ex.exercise_id, blob)}
                />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
