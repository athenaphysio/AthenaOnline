"use client";

import { useState } from "react";
import styles from "../clinic.module.css";
import AudioRecorder from "../AudioRecorder";

export type ProgrammeRow = {
  id: string;
  patient_first_name: string;
  title: string;
  share_code: string;
  audio_url: string | null;
};

export default function ProgrammeAudioList({ programmes }: { programmes: ProgrammeRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string | null>>(
    Object.fromEntries(programmes.map((p) => [p.id, p.audio_url]))
  );

  async function upload(programmeId: string, blob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append("programme_id", programmeId);
    formData.append("audio", blob, "recording.webm");
    const res = await fetch("/api/clinic/audio/programme", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed.");
    setAudioUrls((prev) => ({ ...prev, [programmeId]: data.url }));
    return data.url;
  }

  if (programmes.length === 0) {
    return <p className={styles.notice}>No programmes yet.</p>;
  }

  return (
    <>
      {programmes.map((p) => {
        const isOpen = openId === p.id;
        const hasAudio = Boolean(audioUrls[p.id]);
        return (
          <div key={p.id} className={styles.card}>
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : p.id)}
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
                {p.patient_first_name}
                <span className={styles.exerciseId}>{p.title}</span>
              </span>
              <span style={{ fontSize: 12.5, color: hasAudio ? "var(--crimson)" : "var(--muted)" }}>
                {hasAudio ? "Recorded" : "No recording"}
              </span>
            </button>

            {isOpen && (
              <div style={{ marginTop: 14 }}>
                <AudioRecorder
                  existingUrl={audioUrls[p.id]}
                  onUpload={(blob) => upload(p.id, blob)}
                />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
