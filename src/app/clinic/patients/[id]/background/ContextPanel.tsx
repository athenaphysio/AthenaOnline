"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../dashboard/ClientDashboard.module.css";
import type { ClientDocument, ContextEntry } from "@/lib/clientBackground";
import type { ContextContent } from "@/lib/clientContext";
import { timepointLabel } from "@/lib/passport";
import ContextEditor, { type EditorDraft } from "./ContextEditor";
import { dropStyle } from "./DocumentsPanel";

type Props = {
  patientId: string;
  entries: ContextEntry[];
  notes: ClientDocument[];
  aiOn: boolean;
  blank: ContextContent;
};

// Client context: drop in the Twofold notes from the onboarding
// consultation, check what was read (or fill it in by hand), and save.
export default function ContextPanel({ patientId, entries, notes, aiOn, blank }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<EditorDraft | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const nextTimepoint = entries.length === 0 ? "baseline" : "month_6";

  async function upload(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("title", `Consultation notes, ${file.name}`);
      body.append("dated", today);
      const res = await fetch(`/api/clinic/patients/${patientId}/context/upload`, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "The notes could not be read.");
        return;
      }
      setDraft({
        entryId: null,
        timepoint: nextTimepoint,
        consultedOn: today,
        content: data.content ?? blank,
        documentId: data.document?.id ?? null,
        documentName: data.document?.file_name ?? null,
        fromAi: Boolean(data.content),
      });
      if (data.aiOff) {
        setMessage("The notes file is saved on the record. AI reading is switched off, so fill in the sections below from the notes.");
      }
      router.refresh();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(entry: ContextEntry) {
    if (!confirm(`Delete the ${timepointLabel(entry.timepoint).toLowerCase()} consultation from ${fmt(entry.consulted_on)}? Its scales will also leave the passport.`)) return;
    await fetch(`/api/clinic/patients/${patientId}/context?entry=${entry.id}`, { method: "DELETE" });
    router.refresh();
  }

  if (draft) {
    return (
      <ContextEditor
        patientId={patientId}
        initial={draft}
        notice={message}
        onClose={(saved) => {
          setDraft(null);
          setMessage(saved);
          router.refresh();
        }}
      />
    );
  }

  return (
    <>
      <div className={styles.card} style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 6 }}>Add a consultation</h3>
        <p className={styles.muted} style={{ margin: "0 0 14px", fontSize: 13.5, lineHeight: 1.55 }}>
          Drop in the Twofold notes from the onboarding consultation, or its month 6 repeat.{" "}
          {aiOn
            ? "The app reads them into the fourteen sections of the framework for you to check before anything is saved."
            : "The file is kept on the record and you fill in the sections from it. AI reading is off; it can be switched on in Tools, Features."}
        </p>
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
          onClick={() => !busy && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
          style={dropStyle(dragOver)}
        >
          {busy ? (aiOn ? "Reading the notes, this can take up to a minute" : "Saving the notes") : "Drop the Twofold notes here, or click to choose"}
          <div className={styles.muted} style={{ fontSize: 12.5, marginTop: 4, fontWeight: 400 }}>
            PDF, Word (.docx) or text
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          hidden
          accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={() =>
              setDraft({ entryId: null, timepoint: nextTimepoint, consultedOn: today, content: blank, documentId: null, documentName: null, fromAi: false })
            }
          >
            Or fill it in without a file
          </button>
        </div>
        {message && <p className={styles.muted} style={{ margin: "12px 0 0", fontSize: 13.5 }}>{message}</p>}
      </div>

      <div className={styles.card} style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 10 }}>Consultations</h3>
        {entries.length === 0 && <p className={styles.muted} style={{ margin: 0 }}>None recorded yet.</p>}
        {entries.map((e) => {
          const scored = e.content.scales.filter((s) => s.score != null).length;
          const flags = e.content.flags.length;
          return (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "12px 0", borderTop: "1px solid var(--border)" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {timepointLabel(e.timepoint)}, {fmt(e.consulted_on)}
                </div>
                <div className={styles.muted} style={{ fontSize: 12.5 }}>
                  {scored} of 16 scales, {e.content.goals.length} goal{e.content.goals.length === 1 ? "" : "s"}
                  {flags > 0 && `, ${flags} flag${flags === 1 ? "" : "s"}`}
                  {e.anchor_statement && `. "${e.anchor_statement.slice(0, 80)}${e.anchor_statement.length > 80 ? "..." : ""}"`}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flex: "none" }}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnGhost}`}
                  onClick={() =>
                    setDraft({
                      entryId: e.id,
                      timepoint: e.timepoint,
                      consultedOn: e.consulted_on,
                      content: e.content,
                      documentId: e.source_document_id,
                      documentName: notes.find((n) => n.id === e.source_document_id)?.file_name ?? null,
                      fromAi: false,
                    })
                  }
                >
                  Open
                </button>
                <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => remove(e)}>
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {notes.length > 0 && (
        <div className={styles.card}>
          <h3 style={{ marginBottom: 10 }}>Notes files on record</h3>
          {notes.map((d) => (
            <div key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--border)" }}>
              <div className={styles.muted} style={{ fontSize: 13.5 }}>
                {d.file_name}, added {fmt(d.uploaded_at)}
              </div>
              <a href={`/api/clinic/documents/${d.id}`} target="_blank" rel="noreferrer" className={`${styles.btn} ${styles.btnGhost}`}>
                Open
              </a>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
