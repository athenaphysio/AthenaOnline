"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const OPTIONS = [
  { value: "going_well", label: "Going well" },
  { value: "neutral", label: "Neutral" },
  { value: "worth_watching", label: "Worth watching" },
];

// Your read of one note, in one tap. It feeds the "how it feels" strand of
// the on target measure; the app never reads the words itself.
export default function VoiceNoteTag({ noteId, initial }: { noteId: string; initial: string | null }) {
  const router = useRouter();
  const [tag, setTag] = useState<string | null>(initial);
  const [busy, setBusy] = useState(false);

  async function choose(value: string) {
    const next = tag === value ? null : value;
    setBusy(true);
    try {
      const res = await fetch(`/api/clinic/voice-notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: next }),
      });
      if (res.ok) {
        setTag(next);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={busy}
          onClick={() => choose(o.value)}
          aria-pressed={tag === o.value}
          style={{
            fontSize: 12,
            padding: "3px 10px",
            borderRadius: 12,
            cursor: "pointer",
            border: `1px solid ${tag === o.value ? "var(--ink)" : "var(--mist)"}`,
            background: tag === o.value ? "var(--ink)" : "transparent",
            color: tag === o.value ? "var(--clinic-box, #fff)" : "var(--ink)",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
