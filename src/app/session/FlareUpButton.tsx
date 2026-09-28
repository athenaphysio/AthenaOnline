"use client";

import { useState } from "react";

// "On every running session, a small, calm button" -- shown by TodaySession
// whenever this client has a running programme and isn't already on a
// deload plan (see [programmeId]/page.tsx, which passes hasActiveFlare).
// One tap does everything the brief lists under "Tapping it": the message
// below is simply what that tap looks like from here -- the actual
// 6-day swap, the later rung drop, and David's notification all happen
// server-side in startFlare().
export default function FlareUpButton({ programmeId }: { programmeId: string }) {
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function tap() {
    setState("submitting");
    setError(null);
    try {
      const res = await fetch("/api/session/flare-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programme_id: programmeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "That didn't work.");
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
      setState("error");
    }
  }

  if (state === "done") {
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
        <p style={{ margin: "0 0 10px", fontSize: 14, lineHeight: 1.5 }}>
          No problem. We&apos;ll switch you to a lighter plan for the next few days, then pick up where it makes
          sense.
        </p>
        <div
          style={{
            background: "var(--crimson-light)",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 13,
            color: "var(--crimson-dark)",
            lineHeight: 1.5,
          }}
        >
          If the pain is severe, constant, or you notice new symptoms such as numbness, tingling or weakness,
          contact David directly or call NHS 111. In an emergency, call 999.
        </div>
      </div>
    );
  }

  return (
    <div style={{ margin: "0 22px 16px" }}>
      <button
        type="button"
        onClick={tap}
        disabled={state === "submitting"}
        style={{
          border: "1px solid var(--stone)",
          background: "#fff",
          color: "var(--graphite)",
          borderRadius: 10,
          padding: "9px 16px",
          fontSize: 13.5,
        }}
      >
        {state === "submitting" ? "…" : "Having a flare-up?"}
      </button>
      {error && (
        <div style={{ fontSize: 13, color: "var(--crimson-dark)", marginTop: 6 }}>{error}</div>
      )}
    </div>
  );
}
