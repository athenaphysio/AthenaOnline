"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";

const small = { width: "auto", padding: "0 14px", height: 32, fontSize: 13 } as const;

export default function VoiceNotesControls({ patientId, initialEnabled, hasUnread }: { patientId: string; initialEnabled: boolean; hasUnread: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);

  async function send(method: "PATCH" | "POST", body?: unknown) {
    setBusy(true);
    try {
      const res = await fetch(`/api/clinic/patients/${patientId}/voice-notes`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (!res.ok) throw new Error("Failed.");
      if (method === "PATCH") setEnabled(!enabled);
      router.refresh();
    } catch {
      // Leave as it was.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span className={`${clinicStyles.statusPill} ${enabled ? clinicStyles.statusActive : clinicStyles.statusNoProgramme}`}>{enabled ? "On" : "Off"}</span>
      <button type="button" className={clinicStyles.buttonSecondary} style={small} disabled={busy} onClick={() => send("PATCH", { enabled: !enabled })}>
        {enabled ? "Turn off" : "Turn on"}
      </button>
      {hasUnread && (
        <button type="button" className={clinicStyles.buttonSecondary} style={small} disabled={busy} onClick={() => send("POST")}>
          Mark all as read
        </button>
      )}
    </div>
  );
}
