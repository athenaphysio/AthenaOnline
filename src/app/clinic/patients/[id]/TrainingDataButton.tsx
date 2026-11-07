"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";

// A one tap action on the Training data card, with its outcome shown beside it.
export default function TrainingDataButton({ endpoint, action, label }: { endpoint: string; action: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button
        type="button"
        className={clinicStyles.buttonSecondary}
        style={{ width: "auto", padding: "0 14px", height: 32, fontSize: 13 }}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage(null);
          const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) setMessage(data.error || "That didn't work. Please try again.");
          else if (typeof data.added === "number") setMessage(data.added ? `${data.added} session${data.added === 1 ? "" : "s"} read from Concept2.` : "Up to date; nothing new on Concept2.");
          setBusy(false);
          router.refresh();
        }}
      >
        {busy ? "Working…" : label}
      </button>
      {message && <span style={{ fontSize: 13 }}>{message}</span>}
    </div>
  );
}
