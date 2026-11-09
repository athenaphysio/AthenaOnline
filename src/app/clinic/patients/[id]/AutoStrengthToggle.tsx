"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";

type Props = {
  patientId: string;
  firstName: string;
  initialEnabled: boolean;
};

// On for every client unless switched off. When on, a cardio plan opening in
// the builder has its strength filled from the client's intake form and
// consultation notes, ready for David to edit.
export default function AutoStrengthToggle({ patientId, firstName, initialEnabled }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !enabled;
    setSaving(true);
    try {
      const res = await fetch(`/api/clinic/patients/${patientId}/auto-strength`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error("Failed.");
      setEnabled(next);
      router.refresh();
    } catch {
      // Leave as it was.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={clinicStyles.card}>
      <div className={clinicStyles.cardTitle}>Build strength automatically</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
        <span className={`${clinicStyles.statusPill} ${enabled ? clinicStyles.statusActive : clinicStyles.statusNoProgramme}`}>
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
      <p className={clinicStyles.notice} style={{ marginTop: 10, marginBottom: 0 }}>
        {enabled
          ? `When a plan for ${firstName} opens in the builder, each strength session is built exercise by exercise from your library to fit the strength profile below, with a lighter week every fourth week. You then edit it as you would any programme.`
          : `Strength is left for you to add by hand. You can still press Build strength in the builder.`}
      </p>
    </div>
  );
}
