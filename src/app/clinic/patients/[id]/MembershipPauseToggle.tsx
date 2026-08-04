"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";

type Props = {
  patientId: string;
  initialPaused: boolean;
};

// Manual only -- David takes this action after a conversation with the
// patient, it is never shown to the patient themselves. Pausing stops
// Stripe billing (for a recurring membership) without cancelling anything:
// tier and every programme it gates stay exactly as they are. See
// src/lib/membershipPause.ts for the full mechanism.
export default function MembershipPauseToggle({ patientId, initialPaused }: Props) {
  const router = useRouter();
  const [paused, setPaused] = useState(initialPaused);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !paused;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clinic/patients/${patientId}/membership`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed.");
      setPaused(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        className={paused ? clinicStyles.buttonSecondary : clinicStyles.button}
        style={{ width: "auto", padding: "0 20px" }}
      >
        {saving ? "…" : paused ? "Resume billing" : "Pause billing"}
      </button>
      {error && (
        <div className={clinicStyles.error} style={{ marginTop: 10 }}>
          {error}
        </div>
      )}
    </div>
  );
}
