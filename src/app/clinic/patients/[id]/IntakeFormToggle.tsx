"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";

type Props = {
  patientId: string;
  firstName: string;
  initialEnabled: boolean;
};

// Off for every client unless switched on, since most have a one to one
// consultation. When on, the Programme intake form shows on the client's
// home screen, and one is sent if they have none waiting.
export default function IntakeFormToggle({ patientId, firstName, initialEnabled }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function toggle() {
    const next = !enabled;
    setSaving(true);
    setNote(null);
    try {
      const res = await fetch(`/api/clinic/patients/${patientId}/intake-form`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data = (await res.json()) as { sent?: boolean };
      if (!res.ok) throw new Error("Failed.");
      setEnabled(next);
      if (data.sent) setNote(`The intake form has been sent to ${firstName}.`);
      router.refresh();
    } catch {
      setNote("That did not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={clinicStyles.card}>
      <div className={clinicStyles.cardTitle}>Programme intake form</div>
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
          ? `${firstName} sees the intake form on their home screen until they have filled it in. Use this for a remote client who is not having a one to one consultation.`
          : `${firstName} does not see the intake form. This suits a client who is having a one to one consultation with you instead.`}
      </p>
      {note && (
        <p className={clinicStyles.notice} style={{ marginTop: 8, marginBottom: 0 }}>
          {note}
        </p>
      )}
    </div>
  );
}
