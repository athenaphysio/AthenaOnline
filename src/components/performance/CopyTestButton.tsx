"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// One tap to copy a session that looks like a test into Performance metrics.
export default function CopyTestButton({ endpoint, id }: { endpoint: string; id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const link = { background: "none", border: "none", padding: 0, textDecoration: "underline", cursor: "pointer", color: "inherit", font: "inherit", fontSize: 13.5, fontWeight: 600 } as const;
  return (
    <span>
      <button
        type="button"
        style={link}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "copy_session", id }) });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) setError(data.error || "That didn't save.");
          setBusy(false);
          router.refresh();
        }}
      >
        {busy ? "Adding…" : "Add as a test"}
      </button>
      {error && <span style={{ fontSize: 13 }}> {error}</span>}
    </span>
  );
}
