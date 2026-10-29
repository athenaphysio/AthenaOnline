"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { resizePhoto } from "@/lib/resizePhoto";
import styles from "../dashboard/ClientDashboard.module.css";

// Add, change or remove the client's headshot, shown at the centre of the
// diagram. The photo is optional; clients can add one on the registration
// form, and this is for when it comes in another way.
export default function PhotoControl({ patientId, clientName, hasPhoto }: { patientId: string; clientName: string; hasPhoto: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(file: File) {
    setBusy(true);
    setError(null);
    try {
      const photo = await resizePhoto(file);
      const res = await fetch(`/api/clinic/patients/${patientId}/photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save that photo.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that photo.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Remove ${clientName}'s photo from their record?`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/clinic/patients/${patientId}/photo`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError("Could not remove the photo.");
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, flexWrap: "wrap", fontSize: 13, marginTop: 4 }}>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) choose(f);
        }}
      />
      <button type="button" className={`${styles.btn} ${styles.btnGhost}`} disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "Saving the photo…" : hasPhoto ? "Change photo" : "Add a photo"}
      </button>
      {hasPhoto && !busy && (
        <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={remove}>
          Remove photo
        </button>
      )}
      {!hasPhoto && <span className={styles.muted}>Optional, a head and shoulders photo works best.</span>}
      {error && <span style={{ color: "var(--crimson)" }}>{error}</span>}
    </div>
  );
}
