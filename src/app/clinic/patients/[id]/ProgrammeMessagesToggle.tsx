"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";

type Props = {
  patientId: string;
  firstName: string;
  initialEnabled: boolean;
  /** The client's brand pack already shows the line for everyone on it. */
  onFromPack: boolean;
};

// Off for every client unless switched on. When on, the "Something not
// feeling right? Message David" line shows under their programme.
export default function ProgrammeMessagesToggle({ patientId, firstName, initialEnabled, onFromPack }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function toggle() {
    const next = !enabled;
    setSaving(true);
    setNote(null);
    try {
      const res = await fetch(`/api/clinic/patients/${patientId}/programme-messages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error("Failed.");
      setEnabled(next);
      router.refresh();
    } catch {
      setNote("That did not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const shown = enabled || onFromPack;

  return (
    <div className={clinicStyles.card}>
      <div className={clinicStyles.cardTitle}>Message line under programme</div>
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
        {shown
          ? `${firstName} sees "Something not feeling right? Message David" under their programme.`
          : `${firstName} does not see the message line under their programme.`}
        {onFromPack && !enabled && " Their brand pack has it switched on for everyone, so it shows anyway."}
      </p>
      {note && (
        <p className={clinicStyles.notice} style={{ marginTop: 8, marginBottom: 0 }}>
          {note}
        </p>
      )}
    </div>
  );
}
