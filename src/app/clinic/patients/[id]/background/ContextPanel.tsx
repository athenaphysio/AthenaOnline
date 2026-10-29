"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../dashboard/ClientDashboard.module.css";
import type { ClientDocument, ContextEntry } from "@/lib/clientBackground";
import { timepointLabel } from "@/lib/passport";
import { dropStyle } from "./DocumentsPanel";

type Props = {
  patientId: string;
  clientName: string;
  entries: ContextEntry[];
  notes: ClientDocument[];
};

type Draft = {
  entryId: string | null;
  timepoint: string;
  consultedOn: string;
  summary: string;
  notes: string;
  documentId: string | null;
  documentName: string | null;
};

const TIMEPOINTS = ["baseline", "month_3", "month_6", "review"];

// The person: the Client context summary written in the Twofold template,
// and the full background notes behind it, one pair per consultation.
export default function ContextPanel({ patientId, clientName, entries, notes }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const latest = entries[0] ?? null;
  const today = new Date().toISOString().slice(0, 10);

  function startNew() {
    setMessage(null);
    setDraft({
      entryId: null,
      timepoint: entries.length === 0 ? "baseline" : "month_6",
      consultedOn: today,
      summary: "",
      notes: "",
      documentId: null,
      documentName: null,
    });
  }

  function edit(e: ContextEntry) {
    setMessage(null);
    setDraft({
      entryId: e.id,
      timepoint: e.timepoint,
      consultedOn: e.consulted_on,
      summary: e.summary_text ?? "",
      notes: e.notes_text ?? "",
      documentId: e.source_document_id,
      documentName: notes.find((n) => n.id === e.source_document_id)?.file_name ?? null,
    });
  }

  async function remove(e: ContextEntry) {
    if (!confirm(`Delete the ${label(e.timepoint)} consultation from ${fmt(e.consulted_on)}? The summary and notes will be removed from ${clientName}'s record.`)) return;
    await fetch(`/api/clinic/patients/${patientId}/context?entry=${e.id}`, { method: "DELETE" });
    router.refresh();
  }

  if (draft) {
    return (
      <ConsultationForm
        patientId={patientId}
        initial={draft}
        onClose={(saved) => {
          setDraft(null);
          if (saved) setMessage(saved);
          router.refresh();
        }}
      />
    );
  }

  return (
    <>
      <div className={styles.card} style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
          <div>
            <h3 style={{ margin: 0 }}>Client context summary</h3>
            {latest && (
              <div className={styles.muted} style={{ fontSize: 12.5, marginTop: 2 }}>
                {label(latest.timepoint, true)} consultation, {fmt(latest.consulted_on)}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {latest && (
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => edit(latest)}>
                Edit
              </button>
            )}
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={startNew}>
              Add a consultation
            </button>
          </div>
        </div>

        {message && <p className={styles.muted} style={{ margin: "12px 0 0", fontSize: 13.5 }}>{message}</p>}

        {!latest && (
          <p className={styles.muted} style={{ margin: "14px 0 0", lineHeight: 1.6, maxWidth: 720 }}>
            Nothing recorded yet. Add the onboarding consultation by pasting the summary from your Twofold template, along with the
            full background notes if you have them. The summary is what appears on the Overview, and on the Physiology, Psychology and
            Physicality arms you can add what each of those has shown.
          </p>
        )}

        {latest && <Written text={latest.summary_text} empty="No summary written for this consultation yet." />}

        {latest && (
          <details style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Client context, the full background notes</summary>
            <Written text={latest.notes_text} empty="No background notes added for this consultation." />
            {latest.source_document_id && <FileLink id={latest.source_document_id} notes={notes} />}
          </details>
        )}
      </div>

      {entries.length > 1 && (
        <div className={styles.card} style={{ marginBottom: 18 }}>
          <h3 style={{ marginBottom: 10 }}>Earlier consultations</h3>
          {entries.slice(1).map((e) => (
            <details key={e.id} style={{ padding: "12px 0", borderTop: "1px solid var(--border)" }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                {label(e.timepoint, true)}, {fmt(e.consulted_on)}
              </summary>
              <div className={styles.label} style={{ marginTop: 12 }}>Summary</div>
              <Written text={e.summary_text} empty="No summary written." />
              <div className={styles.label} style={{ marginTop: 14 }}>Full background notes</div>
              <Written text={e.notes_text} empty="No background notes added." />
              {e.source_document_id && <FileLink id={e.source_document_id} notes={notes} />}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => edit(e)}>
                  Edit
                </button>
                <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => remove(e)}>
                  Delete
                </button>
              </div>
            </details>
          ))}
        </div>
      )}

      {latest && (
        <div style={{ textAlign: "right" }}>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => remove(latest)}>
            Delete the {label(latest.timepoint)} consultation
          </button>
        </div>
      )}
    </>
  );
}

function ConsultationForm({ patientId, initial, onClose }: { patientId: string; initial: Draft; onClose: (saved: string | null) => void }) {
  const [d, setD] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function attach(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("title", `Consultation notes, ${file.name}`);
      body.append("dated", d.consultedOn);
      const res = await fetch(`/api/clinic/patients/${patientId}/context/upload`, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "The file could not be saved.");
        return;
      }
      setD((x) => ({
        ...x,
        documentId: data.document?.id ?? x.documentId,
        documentName: data.document?.file_name ?? x.documentName,
        notes: data.text && !x.notes.trim() ? data.text.trim() : x.notes,
      }));
      setFileNote(
        data.text
          ? d.notes.trim()
            ? "The file is attached. Your notes box already had text, so it has been left as it is."
            : "The file is attached and its text is in the notes box below."
          : "The file is attached to this consultation. PDF text cannot be read in here, so it is kept as a file to open."
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clinic/patients/${patientId}/context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry_id: d.entryId,
          timepoint: d.timepoint,
          consulted_on: d.consultedOn,
          summary: d.summary,
          notes: d.notes,
          source_document_id: d.documentId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "That did not save.");
        return;
      }
      onClose(`Saved the ${label(d.timepoint)} consultation.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.card}>
      <h3 style={{ marginBottom: 14 }}>{d.entryId ? "Edit the consultation" : "Add a consultation"}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 240px))", gap: 12, marginBottom: 16 }}>
        <div>
          <label className={styles.fieldLabel} htmlFor="c-time">
            Which consultation
          </label>
          <select id="c-time" className={styles.fieldInput} value={d.timepoint} onChange={(e) => setD({ ...d, timepoint: e.target.value })}>
            {TIMEPOINTS.map((t) => (
              <option key={t} value={t}>
                {label(t, true)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={styles.fieldLabel} htmlFor="c-date">
            Date
          </label>
          <input id="c-date" type="date" className={styles.fieldInput} value={d.consultedOn} onChange={(e) => setD({ ...d, consultedOn: e.target.value })} />
        </div>
      </div>

      <label className={styles.fieldLabel} htmlFor="c-summary">
        Client context summary
      </label>
      <p className={styles.muted} style={{ margin: "0 0 8px", fontSize: 13 }}>
        The short passage from your Twofold template. This is what appears on the Overview. Leave a blank line between paragraphs.
      </p>
      <textarea
        id="c-summary"
        className={styles.fieldInput}
        rows={7}
        value={d.summary}
        onChange={(e) => setD({ ...d, summary: e.target.value })}
        placeholder="Copy the summary from Twofold, then right click here and choose Paste"
        style={{ resize: "vertical", lineHeight: 1.55 }}
      />

      <label className={styles.fieldLabel} htmlFor="c-notes" style={{ marginTop: 18 }}>
        Client context, the full background notes
      </label>
      <p className={styles.muted} style={{ margin: "0 0 8px", fontSize: 13 }}>
        Everything behind the summary. Paste it in, or drop the notes file below and a Word or text file will fill this box for you.
      </p>
      <textarea
        id="c-notes"
        className={styles.fieldInput}
        rows={14}
        value={d.notes}
        onChange={(e) => setD({ ...d, notes: e.target.value })}
        placeholder="Paste the full notes here"
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
          if (f) void attach(f);
        }}
        onClick={() => !busy && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        style={{ ...dropStyle(dragOver), marginTop: 12 }}
      >
        {busy ? "Saving the file" : d.documentName ? `Attached: ${d.documentName}. Drop another to replace it.` : "Drop the notes file here, or click to choose"}
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
          if (f) void attach(f);
        }}
      />
      {fileNote && <p className={styles.muted} style={{ margin: "10px 0 0", fontSize: 13 }}>{fileNote}</p>}
      {error && <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "var(--tone-warn)" }}>{error}</p>}

      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy} onClick={save}>
          {busy ? "Saving" : "Save"}
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnGhost}`} disabled={busy} onClick={() => onClose(null)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function Written({ text, empty }: { text: string | null; empty: string }) {
  const paras = (text ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!paras.length) return <p className={styles.muted} style={{ margin: "12px 0 0" }}>{empty}</p>;
  return (
    <div style={{ marginTop: 12, maxWidth: 820 }}>
      {paras.map((p, i) => (
        <p key={i} style={{ margin: i === 0 ? 0 : "10px 0 0", fontSize: 15, lineHeight: 1.65, whiteSpace: "pre-line" }}>
          {p}
        </p>
      ))}
    </div>
  );
}

function FileLink({ id, notes }: { id: string; notes: ClientDocument[] }) {
  const doc = notes.find((n) => n.id === id);
  return (
    <a href={`/api/clinic/documents/${id}`} target="_blank" rel="noreferrer" className={`${styles.btn} ${styles.btnGhost}`} style={{ display: "inline-block", marginTop: 12 }}>
      Open the notes file{doc ? `, ${doc.file_name}` : ""}
    </a>
  );
}

// "Baseline", "6 month", "Review".
function label(timepoint: string, capital = false): string {
  const l = timepointLabel(timepoint).replace(" months", " month");
  return capital ? l : l.charAt(0).toLowerCase() + l.slice(1);
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
