"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../dashboard/ClientDashboard.module.css";
import type { ClientDocument } from "@/lib/clientBackground";

// Completed questionnaires, stored privately on the client's record. Scores
// are not read from them yet; that waits until the scoring rules for the
// bespoke psychometric are confirmed.
export default function DocumentsPanel({ patientId, documents, clientName }: { patientId: string; documents: ClientDocument[]; clientName: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [dated, setDated] = useState(new Date().toISOString().slice(0, 10));
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("title", title.trim() || file.name.replace(/\.[^.]+$/, ""));
      body.append("dated", dated);
      body.append("kind", "questionnaire");
      const res = await fetch(`/api/clinic/patients/${patientId}/documents`, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "That did not save.");
        return;
      }
      setTitle("");
      setMessage(`Saved "${data.document.title}".`);
      router.refresh();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(doc: ClientDocument) {
    if (!confirm(`Delete "${doc.title}"? The file will be removed from ${clientName}'s record.`)) return;
    await fetch(`/api/clinic/documents/${doc.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <>
      <div className={styles.card} style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 6 }}>Add a completed questionnaire</h3>
        <p className={styles.muted} style={{ margin: "0 0 14px", fontSize: 13.5 }}>
          Keep {clientName}&apos;s completed questionnaires on their record, for example a Jisc export of the bespoke psychometric.
          Files are stored privately and only open from the clinic.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 12, marginBottom: 12 }}>
          <div>
            <label className={styles.fieldLabel} htmlFor="q-title">
              Name
            </label>
            <input id="q-title" className={styles.fieldInput} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="For example, Psychometric, baseline" />
          </div>
          <div>
            <label className={styles.fieldLabel} htmlFor="q-date">
              Completed on
            </label>
            <input id="q-date" type="date" className={styles.fieldInput} value={dated} onChange={(e) => setDated(e.target.value)} />
          </div>
        </div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void upload(f);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
          style={dropStyle(dragOver)}
        >
          {busy ? "Saving" : "Drop the file here, or click to choose"}
          <div className={styles.muted} style={{ fontSize: 12.5, marginTop: 4 }}>
            PDF, Word, Excel, CSV or an image
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        {message && <p className={styles.muted} style={{ margin: "10px 0 0", fontSize: 13 }}>{message}</p>}
      </div>

      <div className={styles.card}>
        <h3 style={{ marginBottom: 10 }}>On file</h3>
        {documents.length === 0 && <p className={styles.muted} style={{ margin: 0 }}>No questionnaires yet.</p>}
        {documents.map((d) => (
          <div key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--border)" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{d.title}</div>
              <div className={styles.muted} style={{ fontSize: 12.5 }}>
                {d.dated ? `Completed ${fmt(d.dated)}` : `Added ${fmt(d.uploaded_at)}`}, {d.file_name}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flex: "none" }}>
              <a href={`/api/clinic/documents/${d.id}`} target="_blank" rel="noreferrer" className={`${styles.btn} ${styles.btnGhost}`}>
                Open
              </a>
              <button type="button" onClick={() => remove(d)} className={`${styles.btn} ${styles.btnGhost}`}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function dropStyle(active: boolean) {
  return {
    border: `2px dashed ${active ? "var(--crimson)" : "var(--border-strong)"}`,
    background: active ? "rgba(var(--wash), 0.08)" : "transparent",
    borderRadius: 14,
    padding: "26px 16px",
    textAlign: "center" as const,
    cursor: "pointer",
    fontSize: 14.5,
    fontWeight: 600,
  };
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
