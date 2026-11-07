"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PERFORMANCE_TYPES, performanceType } from "@/lib/performanceTypes";

export type TestPrefill = {
  tested_on?: string;
  test_type?: string;
  result_text?: string;
  distance_m?: number | null;
  split_text?: string;
  stroke_rate?: number | null;
  drag_factor?: number | null;
  rowing_result_id?: string | null;
};

// Add a single test or race. Used by the client on their own page and by
// Dr David Silver PhD on the client's page, with the same fields.
export default function TestResultForm({
  endpoint,
  buttonClass,
  prefill,
  onDone,
}: {
  endpoint: string;
  buttonClass: string;
  prefill?: TestPrefill;
  onDone?: () => void;
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [testedOn, setTestedOn] = useState(prefill?.tested_on ?? today);
  const [type, setType] = useState(prefill?.test_type ?? "");
  const [result, setResult] = useState(prefill?.result_text ?? "");
  const [distance, setDistance] = useState(prefill?.distance_m ? String(prefill.distance_m) : "");
  const [split, setSplit] = useState(prefill?.split_text ?? "");
  const [rate, setRate] = useState(prefill?.stroke_rate ? String(prefill.stroke_rate) : "");
  const [drag, setDrag] = useState(prefill?.drag_factor ? String(prefill.drag_factor) : "");
  const [isRace, setIsRace] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const info = performanceType(type);
  const rowing = info?.family === "row" || info?.family === "other";
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
        body: JSON.stringify({
          action: "add_test",
          tested_on: testedOn,
          test_type: type,
          result_text: result,
          distance_m: distance || null,
          split_text: split || null,
          stroke_rate: rate || null,
          drag_factor: drag || null,
          is_race: isRace,
          notes: notes || null,
          rowing_result_id: prefill?.rowing_result_id ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "That result couldn't be saved.");
      setMessage("Saved to Performance metrics.");
      setResult("");
      setNotes("");
      setSplit("");
      setRate("");
      setDrag("");
      router.refresh();
      onDone?.();
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
          Date
          <input type="date" value={testedOn} max={today} onChange={(e) => setTestedOn(e.target.value)} style={box} />
        </label>
        <label style={lab}>
          What it was
          <select value={type} onChange={(e) => setType(e.target.value)} style={box}>
            <option value="">Choose…</option>
            {PERFORMANCE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label style={lab}>
          {info?.measure === "watts" ? "Average watts" : info?.measure === "time" ? "Time" : "Result"}
          <input
            value={result}
            onChange={(e) => setResult(e.target.value)}
            placeholder={info?.measure === "watts" ? "for example 262" : "for example 24:30 or 1:58:10"}
            style={box}
          />
        </label>
        {(info?.value === "long_row" || info?.value === "other") && (
          <label style={lab}>
            Distance in metres
            <input inputMode="numeric" value={distance} onChange={(e) => setDistance(e.target.value.replace(/[^\d]/g, ""))} style={box} />
          </label>
        )}
      </div>

      {rowing && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
          <label style={lab}>
            Average split /500m
            <input value={split} onChange={(e) => setSplit(e.target.value)} placeholder="1:52.0" style={box} />
          </label>
          <label style={lab}>
            Stroke rate
            <input inputMode="numeric" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d]/g, ""))} style={box} />
          </label>
          <label style={lab}>
            Drag factor
            <input inputMode="numeric" value={drag} onChange={(e) => setDrag(e.target.value.replace(/[^\d]/g, ""))} style={box} />
          </label>
        </div>
      )}

      <div style={{ display: "flex", gap: 16, fontSize: 14 }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="radio" checked={!isRace} onChange={() => setIsRace(false)} /> A test
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="radio" checked={isRace} onChange={() => setIsRace(true)} /> A race
        </label>
      </div>

      <label style={lab}>
        Notes (optional)
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Conditions, how it felt, anything you noticed" style={box} />
      </label>

      <button type="button" className={buttonClass} disabled={busy || !type || !result.trim()} onClick={save}>
        {busy ? "Saving…" : "Save this result"}
      </button>
      {message && <p style={{ margin: 0, fontSize: 14 }}>{message}</p>}
      {error && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{error}</p>}
    </div>
  );
}
