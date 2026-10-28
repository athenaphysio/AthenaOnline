"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../../clinic/clinic.module.css";

export default function CoachNoteForm({ patientId, sections }: { patientId: string; sections: { key: string; label: string }[] }) {
  const router = useRouter();
  const [section, setSection] = useState(sections[0]?.key ?? "");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/coach/clients/${patientId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "The note could not be saved.");
        return;
      }
      setBody("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
        <select
          id="coach-note-section"
          className={styles.input}
          style={{ width: "auto", fontSize: 14, padding: "6px 10px" }}
          value={section}
          onChange={(e) => setSection(e.target.value)}
        >
          {sections.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <textarea
          id="coach-note-body"
          className={styles.textarea}
          style={{ flex: "1 1 320px", minHeight: 70, fontFamily: "var(--font-inter), sans-serif", fontSize: 14 }}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note for the care team. The client does not see these."
        />
        <button
          type="button"
          className={styles.buttonSecondary}
          style={{ width: "auto", padding: "0 16px", height: 34, fontSize: 13 }}
          disabled={busy || !body.trim()}
          onClick={save}
        >
          Add note
        </button>
      </div>
      {error && <div className={styles.error} style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}
