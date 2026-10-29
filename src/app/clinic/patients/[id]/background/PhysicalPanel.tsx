"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../dashboard/ClientDashboard.module.css";
import type { ClientDocument, PhysicalEntry } from "@/lib/clientBackground";
import { PHYSICAL_SECTIONS, type PhysicalSection } from "@/lib/personMap";
import { dropStyle } from "./DocumentsPanel";

type Props = {
  patientId: string;
  clientName: string;
  entries: PhysicalEntry[];
  files: ClientDocument[];
};

type Draft = { entryId: string | null; section: PhysicalSection; dated: string; title: string; body: string; documentId: string | null };

// Physicality: what the physiotherapy assessment found, in three parts.
export default function PhysicalPanel({ patientId, clientName, entries, files }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  async function remove(e: PhysicalEntry) {
    if (!confirm(`Delete this note from ${clientName}'s record${e.document_id ? ", along with its file" : ""}?`)) return;
    await fetch(`/api/clinic/patients/${patientId}/physical?entry=${e.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <>
      {PHYSICAL_SECTIONS.map((s) => {
        const own = entries.filter((e) => e.section === s.key);
        const editingHere = draft?.section === s.key;
        return (
          <div key={s.key} className={styles.card} style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
              <div>
                <h3 style={{ margin: 0 }}>{s.label}</h3>
                <div className={styles.muted} style={{ fontSize: 13, marginTop: 2 }}>
                  {s.hint}
                </div>
              </div>
              {!editingHere && (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnGhost}`}
                  onClick={() => setDraft({ entryId: null, section: s.key, dated: today, title: "", body: "", documentId: null })}
                >
                  Add
                </button>
              )}
            </div>

            {editingHere && draft && !draft.entryId && (
              <NoteForm
                patientId={patientId}
                initial={draft}
                onClose={() => {
                  setDraft(null);
                  router.refresh();
                }}
              />
            )}

            {own.length === 0 && !editingHere && (
              <p className={styles.muted} style={{ margin: "12px 0 0", fontSize: 13.5 }}>
                Nothing recorded yet.
              </p>
            )}

            {own.map((e) =>
              draft?.entryId === e.id ? (
                <NoteForm
                  key={e.id}
                  patientId={patientId}
                  initial={draft}
                  onClose={() => {
                    setDraft(null);
                    router.refresh();
                  }}
                />
              ) : (
                <div key={e.id} style={{ borderTop: "1px solid var(--border)", padding: "12px 0", marginTop: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 600 }}>
                      {e.title || s.label}
                      <span className={styles.muted} style={{ fontWeight: 400 }}>
                        , {fmt(e.dated)}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {e.document_id && (
                        <a href={`/api/clinic/documents/${e.document_id}`} target="_blank" rel="noreferrer" className={`${styles.btn} ${styles.btnGhost}`}>
                          Open {files.find((f) => f.id === e.document_id)?.file_name ?? "file"}
                        </a>
                      )}
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnGhost}`}
                        onClick={() =>
                          setDraft({ entryId: e.id, section: e.section, dated: e.dated, title: e.title ?? "", body: e.body ?? "", documentId: e.document_id })
                        }
                      >
                        Edit
                      </button>
                      <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => remove(e)}>
                        Delete
                      </button>
                    </div>
                  </div>
                  {e.body && (
                    <p style={{ margin: "8px 0 0", fontSize: 14.5, lineHeight: 1.6, whiteSpace: "pre-line", maxWidth: 820 }}>{e.body}</p>
                  )}
                </div>
              )
            )}
          </div>
        );
      })}
    </>
  );
}

function NoteForm({ patientId, initial, onClose }: { patientId: string; initial: Draft; onClose: () => void }) {
  const [d, setD] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = d.entryId ?? d.section;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      if (d.entryId) body.append("entry_id", d.entryId);
      body.append("section", d.section);
      body.append("dated", d.dated);
      body.append("title", d.title);
      body.append("body", d.body);
      if (d.documentId && !file) body.append("document_id", d.documentId);
      if (file) body.append("file", file);
      const res = await fetch(`/api/clinic/patients/${patientId}/physical`, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "That did not save.");
        return;
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ borderTop: "1px solid var(--border)", marginTop: 12, paddingTop: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 12, marginBottom: 12 }}>
        <div>
          <label className={styles.fieldLabel} htmlFor={`t-${id}`}>
            Heading, if it helps
          </label>
          <input id={`t-${id}`} className={styles.fieldInput} value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="For example, Baseline screen" />
        </div>
        <div>
          <label className={styles.fieldLabel} htmlFor={`d-${id}`}>
            Date
          </label>
          <input id={`d-${id}`} type="date" className={styles.fieldInput} value={d.dated} onChange={(e) => setD({ ...d, dated: e.target.value })} />
        </div>
      </div>
      <label className={styles.fieldLabel} htmlFor={`b-${id}`}>
        Notes
      </label>
      <textarea
        id={`b-${id}`}
        className={styles.fieldInput}
        rows={8}
        value={d.body}
        onChange={(e) => setD({ ...d, body: e.target.value })}
        placeholder="Write or paste your findings here"
        style={{ resize: "vertical", lineHeight: 1.55 }}
      />
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
          if (f) setFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        style={{ ...dropStyle(dragOver), marginTop: 12, padding: "14px" }}
      >
        {file ? `Ready to attach: ${file.name}` : d.documentId ? "A file is attached. Drop another to replace it." : "Attach a file if you have one, such as a screen sheet or a PDF of results"}
      </div>
      <input
        ref={inputRef}
        type="file"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setFile(f);
        }}
      />
      {error && <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "var(--tone-warn)" }}>{error}</p>}
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy} onClick={save}>
          {busy ? "Saving" : "Save"}
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnGhost}`} disabled={busy} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
