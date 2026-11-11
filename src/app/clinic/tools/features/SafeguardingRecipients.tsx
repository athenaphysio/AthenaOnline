"use client";

import { useState } from "react";
import styles from "../../clinic.module.css";

// Who receives the safeguarding alert, alongside the clinic owner.
export default function SafeguardingRecipients({ initial, owner }: { initial: string[]; owner: string }) {
  const [text, setText] = useState(initial.join(", "));
  const [saved, setSaved] = useState(initial.join(", "));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const emails = text.split(/[,\s;]+/).filter(Boolean);
      const res = await fetch("/api/clinic/settings/safeguarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "That did not save.");
        return;
      }
      const joined = (data.emails as string[]).join(", ");
      setText(joined);
      setSaved(joined);
      setMessage("Saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.card} style={{ marginTop: 16 }}>
      <div className={styles.cardTitle}>Safeguarding alerts</div>
      <p className={styles.notice} style={{ marginTop: 0 }}>
        When a client answers the self harm question above zero on the Wellbeing survey, an alert goes straight away to {owner}
        and to every address below, and stays on the clinic home page until someone marks it as reviewed.
      </p>
      <input
        className={styles.input}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Other addresses, separated by commas"
      />
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
        <button
          type="button"
          className={styles.buttonSecondary}
          style={{ width: "auto", padding: "0 16px", height: 32, fontSize: 13 }}
          onClick={save}
          disabled={busy || text === saved}
        >
          Save
        </button>
        {message && <span style={{ fontSize: 13 }}>{message}</span>}
      </div>
    </div>
  );
}
