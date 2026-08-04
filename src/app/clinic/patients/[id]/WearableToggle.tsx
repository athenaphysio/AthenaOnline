"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";

type Props = {
  patientId: string;
  initialEnabled: boolean;
};

// David's own lever, set here on the patient record -- never tied
// automatically to tier except the one Athena Athlete default, and even
// that can be switched off or on again freely from here.
export default function WearableToggle({ patientId, initialEnabled }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !enabled;
    setSaving(true);
    try {
      const res = await fetch(`/api/clinic/patients/${patientId}/wearable`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error("Failed.");
      setEnabled(next);
      router.refresh();
    } catch {
      // Leave as-is on failure.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={clinicStyles.card}>
      <div className={clinicStyles.cardTitle}>Wearable tracking</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
        <span
          className={`${clinicStyles.statusPill} ${enabled ? clinicStyles.statusActive : clinicStyles.statusNoProgramme}`}
        >
          {enabled ? "On" : "Off"}
        </span>
        <button
          type="button"
          onClick={toggle}
          disabled={saving}
          className={clinicStyles.buttonSecondary}
          style={{ width: "auto", padding: "0 16px", height: 32, fontSize: 13 }}
        >
          {saving ? "…" : enabled ? "Turn off" : "Turn on"}
        </button>
      </div>
    </div>
  );
}
