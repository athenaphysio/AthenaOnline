"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./ClientDashboard.module.css";

// Delete for one draft on the client record, either a saved programme that
// was never sent or plan code from Claude. Asks once before it goes.
export default function DraftDeleteButton({ kind, id }: { kind: "saved" | "claude"; id: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const url = kind === "saved" ? `/api/clinic/programme-drafts/${id}` : `/api/clinic/imported-plans/${id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "That did not delete.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not delete.");
      setBusy(false);
    }
  }

  if (!asking) {
    return (
      <button type="button" className={`${styles.btn} ${styles.btnGhost}`} style={{ whiteSpace: "nowrap" }} onClick={() => setAsking(true)}>
        Delete
      </button>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontSize: 13 }}>{error ?? "Delete this draft for good?"}</span>
      <button type="button" className={styles.btn} style={{ whiteSpace: "nowrap" }} disabled={busy} onClick={() => void remove()}>
        {busy ? "Deleting…" : "Yes, delete"}
      </button>
      <button type="button" className={`${styles.btn} ${styles.btnGhost}`} style={{ whiteSpace: "nowrap" }} disabled={busy} onClick={() => setAsking(false)}>
        Keep
      </button>
    </span>
  );
}
