"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";

export default function RemoveSampleDataButton({ patientId, firstName, titles }: { patientId: string; firstName: string; titles: string[] }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/clinic/patients/${patientId}/sample-data`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  const small = { width: "auto", padding: "0 14px", height: 30, fontSize: 12.5 } as const;

  return (
    <div className={clinicStyles.card}>
      <div className={clinicStyles.cardTitle}>Sample data</div>
      <p className={clinicStyles.notice} style={{ marginTop: 6 }}>
        {firstName}&apos;s account holds example entries so they can see how the app looks: {titles.join(", ")}, with its sessions,
        session logs, strength logs, diary slots and two voice notes. Anything {firstName} enters themselves is kept separate and is not
        touched when the sample is removed.
      </p>
      {confirming ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className={clinicStyles.buttonSecondary} style={small} onClick={remove} disabled={busy}>
            {busy ? "Removing" : "Yes, remove it"}
          </button>
          <button type="button" className={clinicStyles.buttonSecondary} style={small} onClick={() => setConfirming(false)} disabled={busy}>
            Keep it
          </button>
        </div>
      ) : (
        <button type="button" className={clinicStyles.buttonSecondary} style={small} onClick={() => setConfirming(true)}>
          Remove sample data
        </button>
      )}
    </div>
  );
}
