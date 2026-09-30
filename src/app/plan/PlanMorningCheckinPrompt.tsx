"use client";

import { useState } from "react";

type Answer = "better" | "same" | "worse";

const OPTIONS: { value: Answer; label: string }[] = [
  { value: "better", label: "Better" },
  { value: "same", label: "Same" },
  { value: "worse", label: "Worse" },
];

export default function PlanMorningCheckinPrompt({ logId }: { logId: string }) {
  const [answered, setAnswered] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function answer(value: Answer) {
    setSubmitting(true);
    try {
      await fetch("/api/plan/morning-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log_id: logId, answer: value }),
      });
      setAnswered(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ background: "var(--mist)", borderRadius: 14, padding: "16px 18px", margin: "0 22px 16px", color: "var(--graphite)" }}>
      {!answered ? (
        <>
          <div style={{ fontSize: 14, marginBottom: 12 }}>How does it feel this morning compared with before yesterday&apos;s session?</div>
          <div style={{ display: "flex", gap: 8 }}>
            {OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={submitting}
                onClick={() => answer(opt.value)}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid var(--stone)", background: "#fff", fontSize: 14, fontWeight: 500, color: "var(--graphite)" }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 14 }}>Thank you, that&apos;s noted.</div>
      )}
    </div>
  );
}
