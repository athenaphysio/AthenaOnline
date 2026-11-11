"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Alert = { id: string; patientId: string; name: string; createdAt: string; emailSent: boolean; formTitle: string | null };

// Open safeguarding alerts, at the top of the clinic home page until a
// clinician records that each has been reviewed.
export default function SafeguardingAlerts({ alerts }: { alerts: Alert[] }) {
  const router = useRouter();
  const [who, setWho] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (alerts.length === 0) return null;

  async function review(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/clinic/safeguarding-alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, reviewedBy: who[id] ?? "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "That did not save.");
      else router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ border: "2px solid #b4232a", background: "#fff4f3", borderRadius: 12, padding: "14px 16px", marginBottom: 18, color: "#2b1b1b" }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
        Safeguarding: {alerts.length === 1 ? "one client needs" : `${alerts.length} clients need`} a same day review
      </div>
      {alerts.map((a) => (
        <div key={a.id} style={{ borderTop: "1px solid #efc9c6", padding: "8px 0", fontSize: 13.5, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ flex: "1 1 260px" }}>
            <Link href={`/clinic/patients/${a.patientId}/forms`} style={{ color: "inherit", fontWeight: 600 }}>
              {a.name}
            </Link>{" "}
            answered the self harm question above zero on the {a.formTitle ?? "survey"},{" "}
            {new Date(a.createdAt).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.
            {!a.emailSent && " The alert email did not go through, so this page is the only notice."}
          </span>
          <input
            value={who[a.id] ?? ""}
            onChange={(e) => setWho({ ...who, [a.id]: e.target.value })}
            placeholder="Reviewed by"
            style={{ height: 30, border: "1px solid #d9b0ac", borderRadius: 6, padding: "0 8px", fontSize: 13 }}
          />
          <button
            type="button"
            onClick={() => review(a.id)}
            disabled={busy === a.id || !(who[a.id] ?? "").trim()}
            style={{ height: 30, padding: "0 12px", borderRadius: 6, border: "1px solid #b4232a", background: "#fff", color: "#b4232a", fontSize: 13, cursor: "pointer" }}
          >
            Mark as reviewed
          </button>
        </div>
      ))}
      {error && <div style={{ fontSize: 13, marginTop: 6 }}>{error}</div>}
    </div>
  );
}
