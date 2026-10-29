"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// A small slider that turns the client's My Passport tab on or off in
// their app. Only released results are ever shown to the client.
export default function PassportViewSwitch({ patientId, clientName, initialEnabled }: { patientId: string; clientName: string; initialEnabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function toggle() {
    const next = !enabled;
    setBusy(true);
    setError(false);
    setEnabled(next);
    try {
      const res = await fetch(`/api/clinic/patients/${patientId}/passport`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setEnabled(!next);
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <label
      title={enabled ? `${clientName} can see My Passport in the app, showing released results only.` : `${clientName} cannot see My Passport in the app.`}
      style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 13.5, fontWeight: 600, cursor: busy ? "wait" : "pointer", userSelect: "none" }}
    >
      <span>Client passport view</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`Client passport view for ${clientName}`}
        disabled={busy}
        onClick={toggle}
        style={{
          position: "relative",
          width: 44,
          height: 24,
          borderRadius: 999,
          border: "none",
          padding: 0,
          cursor: "inherit",
          background: enabled ? "var(--crimson)" : "rgba(var(--wash), 0.25)",
          transition: "background 160ms ease",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 3,
            left: enabled ? 23 : 3,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
            transition: "left 160ms ease",
          }}
        />
      </button>
      <span style={{ fontWeight: 500, opacity: 0.8, minWidth: 22 }}>{enabled ? "On" : "Off"}</span>
      {error && <span style={{ color: "var(--crimson)", fontWeight: 500 }}>Could not change that, please try again.</span>}
    </label>
  );
}
