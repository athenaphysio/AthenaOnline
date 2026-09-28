"use client";

import { useState } from "react";

type Answer = "better" | "same" | "worse";

const OPTIONS: { value: Answer; label: string }[] = [
  { value: "better", label: "Better" },
  { value: "same", label: "Same" },
  { value: "worse", label: "Worse" },
];

// Shown once, the day after a Run block was marked done -- see
// [programmeId]/page.tsx, which only passes this in as `banner` when
// there's a completed run from an earlier day with no answer yet.
export default function MorningCheckinPrompt({ sessionCompletionId }: { sessionCompletionId: string }) {
  const [answered, setAnswered] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function answer(value: Answer) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/session/morning-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_completion_id: sessionCompletionId, answer: value }),
      });
      const data = await res.json();
      setMessage(res.ok ? data.message : "Thank you, that's noted.");
      setAnswered(true);
    } catch {
      setMessage("Thank you, that's noted.");
      setAnswered(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        background: "var(--mist)",
        borderRadius: 14,
        padding: "16px 18px",
        margin: "0 22px 16px",
        color: "var(--graphite)",
      }}
    >
      {!answered ? (
        <>
          <div style={{ fontSize: 14, marginBottom: 12 }}>
            How does it feel this morning compared with before yesterday&apos;s run?
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={submitting}
                onClick={() => answer(opt.value)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 10,
                  border: "1px solid var(--stone)",
                  background: "#fff",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--graphite)",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 14 }}>{message}</div>
      )}
    </div>
  );
}
