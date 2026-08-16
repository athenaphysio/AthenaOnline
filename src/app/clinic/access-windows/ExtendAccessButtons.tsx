"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../clinic.module.css";

// The Phase 6 safety valve -- one click, no form. "+2/+4 weeks" push the
// closure date that many weeks out from today, regardless of how overdue
// the patient already is (see extend-access/route.ts); "Never closes"
// clears access_window_weeks entirely for this one patient, without
// touching the 6-week system default anyone else's new programme still
// gets.
export default function ExtendAccessButtons({ programmeId }: { programmeId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function extend(label: string, weeks: number | null) {
    setSaving(label);
    setError(null);
    try {
      const res = await fetch(`/api/clinic/programmes/${programmeId}/extend-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't update that.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update that.");
      setSaving(null);
    }
  }

  const btnStyle = {
    width: "auto",
    height: "auto",
    padding: "6px 12px",
    fontSize: 12,
  } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" className={styles.buttonSecondary} style={btnStyle} disabled={!!saving} onClick={() => extend("+2", 2)}>
          {saving === "+2" ? "…" : "+2 weeks"}
        </button>
        <button type="button" className={styles.buttonSecondary} style={btnStyle} disabled={!!saving} onClick={() => extend("+4", 4)}>
          {saving === "+4" ? "…" : "+4 weeks"}
        </button>
        <button type="button" className={styles.button} style={btnStyle} disabled={!!saving} onClick={() => extend("never", null)}>
          {saving === "never" ? "…" : "Never closes"}
        </button>
      </div>
      {error && <div style={{ fontSize: 11.5, color: "var(--crimson)", maxWidth: 220, textAlign: "right" }}>{error}</div>}
    </div>
  );
}
