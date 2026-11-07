"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GOAL_TYPES, performanceType } from "@/lib/performanceTypes";

export type GoalPrefill = {
  id?: string;
  goal_type?: string;
  target_text?: string;
  distance_m?: number | null;
  goal_date?: string | null;
  event_name?: string | null;
};

// Adds or changes one goal. Goals are set by Dr David Silver PhD only.
export default function GoalEditor({ endpoint, buttonClass, prefill }: { endpoint: string; buttonClass: string; prefill?: GoalPrefill }) {
  const router = useRouter();
  const [type, setType] = useState(prefill?.goal_type ?? "");
  const [target, setTarget] = useState(prefill?.target_text ?? "");
  const [distance, setDistance] = useState(prefill?.distance_m ? String(prefill.distance_m) : "");
  const [date, setDate] = useState(prefill?.goal_date ?? "");
  const [event, setEvent] = useState(prefill?.event_name ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const info = performanceType(type);
  const box = { width: "100%", padding: "9px 11px", borderRadius: 10, border: "1px solid rgba(127,127,127,0.35)", font: "inherit", fontSize: 14, background: "transparent", color: "inherit", boxSizing: "border-box" as const };
  const lab = { display: "flex", flexDirection: "column" as const, gap: 4, fontSize: 13.5 };

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_goal", id: prefill?.id, goal_type: type, target_text: target, distance_m: distance || null, goal_date: date, event_name: event }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "That goal couldn't be saved.");
      setMessage("Goal saved.");
      if (!prefill?.id) {
        setType("");
        setTarget("");
        setDistance("");
        setDate("");
        setEvent("");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <label style={lab}>
          Goal
          <select value={type} onChange={(e) => setType(e.target.value)} style={box}>
            <option value="">Choose…</option>
            {GOAL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label style={lab}>
          Target
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={info?.measure === "watts" ? "290 W" : "4:05:00, or 1:47 /500m"}
            style={box}
          />
        </label>
        {(info?.value === "long_row" || info?.value === "other") && (
          <label style={lab}>
            Distance in metres
            <input inputMode="numeric" value={distance} onChange={(e) => setDistance(e.target.value.replace(/[^\d]/g, ""))} placeholder="60000" style={box} />
          </label>
        )}
        <label style={lab}>
          Date (blank if no event)
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={box} />
        </label>
        <label style={lab}>
          Event name
          <input value={event} onChange={(e) => setEvent(e.target.value)} placeholder="London Marathon" style={box} />
        </label>
      </div>
      <button type="button" className={buttonClass} disabled={busy || !type || !target.trim()} onClick={save}>
        {busy ? "Saving…" : prefill?.id ? "Save the changes" : "Add this goal"}
      </button>
      {message && <p style={{ margin: 0, fontSize: 14 }}>{message}</p>}
      {error && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{error}</p>}
    </div>
  );
}
