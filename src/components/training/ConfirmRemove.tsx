"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Two taps, so nothing is removed by accident.
export default function ConfirmRemove({ endpoint, body, question }: { endpoint: string; body: Record<string, unknown>; question: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const link = { background: "none", border: "none", padding: 0, marginTop: 4, textDecoration: "underline", cursor: "pointer", color: "inherit", fontSize: 12.5, opacity: 0.75 } as const;

  if (!confirming) {
    return (
      <button type="button" style={link} onClick={() => setConfirming(true)}>
        Remove
      </button>
    );
  }
  return (
    <span style={{ fontSize: 12.5 }}>
      {question}{" "}
      <button
        type="button"
        style={link}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
          setBusy(false);
          setConfirming(false);
          router.refresh();
        }}
      >
        {busy ? "Removing…" : "Yes, remove it"}
      </button>{" "}
      <button type="button" style={link} onClick={() => setConfirming(false)}>
        Keep it
      </button>
    </span>
  );
}
