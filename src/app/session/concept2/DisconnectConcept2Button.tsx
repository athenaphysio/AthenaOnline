"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DisconnectConcept2Button() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      style={{ background: "none", border: "none", padding: 0, textDecoration: "underline", cursor: "pointer", color: "inherit", fontSize: 14, alignSelf: "flex-start" }}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/session/concept2/disconnect", { method: "POST" });
        router.refresh();
        setBusy(false);
      }}
    >
      {busy ? "Unlinking…" : "Unlink Concept2"}
    </button>
  );
}
