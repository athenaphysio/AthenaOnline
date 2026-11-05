"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";
import { formatSplit } from "@/lib/rowing/zones";

export type PendingSuggestion = {
  id: string;
  kind: "new_test" | "paces_up" | "paces_down" | "hold_week";
  reason: string;
  evidence: { date: string; text: string }[];
  from_split_seconds: number | null;
  to_split_seconds: number | null;
  created_at: string;
};

const KIND_TITLE: Record<PendingSuggestion["kind"], string> = {
  new_test: "New test result",
  paces_up: "Ready for quicker paces",
  paces_down: "Ease the paces",
  hold_week: "Hold this week",
};

const small = { width: "auto", padding: "0 14px", height: 32, fontSize: 13 } as const;

export default function RowingActions({ programmeId, pending, sport = "row" }: { programmeId: string; pending: PendingSuggestion[]; sport?: "row" | "run" }) {
  const noun = sport === "row" ? "row" : "run";
  const unit = sport === "row" ? "500m" : "km";
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ rowed_on: new Date().toISOString().slice(0, 10), distance_m: "", minutes: "", seconds: "", stroke_rate: "", avg_hr: "", is_test: false });

  async function call(label: string, url: string, body: unknown, done: (data: Record<string, unknown>) => string) {
    setBusy(label);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "That didn't work.");
      setMessage(done(data));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ marginTop: 14 }}>
      {pending.map((s) => (
        <div key={s.id} className={clinicStyles.warningCard} style={{ marginBottom: 10 }}>
          <div className={clinicStyles.warningTitle}>
            {KIND_TITLE[s.kind]}
            {s.to_split_seconds != null && s.from_split_seconds != null
              ? `: ${formatSplit(Number(s.from_split_seconds))} to ${formatSplit(Number(s.to_split_seconds))} per ${unit}`
              : ""}
          </div>
          <div className={clinicStyles.warningItem}>{s.reason}</div>
          {s.evidence.map((e, i) => (
            <div key={i} className={clinicStyles.warningItem} style={{ fontSize: 12.5 }}>
              {e.date}: {e.text}
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className={clinicStyles.button}
              style={small}
              disabled={busy !== null}
              onClick={() => call(s.id, `/api/clinic/rowing/suggestions/${s.id}`, { action: "approve" }, (d) => String(d.message ?? "Done."))}
            >
              {busy === s.id ? "Applying…" : "Approve"}
            </button>
            <button
              type="button"
              className={clinicStyles.buttonSecondary}
              style={small}
              disabled={busy !== null}
              onClick={() => call(`${s.id}-hold`, `/api/clinic/rowing/suggestions/${s.id}`, { action: "hold" }, (d) => String(d.message ?? "Held."))}
            >
              Hold
            </button>
          </div>
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className={clinicStyles.buttonSecondary}
          style={small}
          disabled={busy !== null}
          onClick={() =>
            call("refresh", `/api/clinic/rowing/${programmeId}/refresh`, {}, (d) =>
              sport === "run"
                ? `${d.suggestions} new suggestion${d.suggestions === 1 ? "" : "s"} from the runs added so far.`
                : d.connected
                ? `${d.added} ${noun}${d.added === 1 ? "" : "s"} checked, ${d.suggestions} new suggestion${d.suggestions === 1 ? "" : "s"}.${d.syncError ? ` Concept2 said: ${d.syncError}` : ""}`
                : `Not connected to Concept2, so nothing new to pull. ${d.suggestions} new suggestion${d.suggestions === 1 ? "" : "s"} from the rows already here.`
            )
          }
        >
          {busy === "refresh" ? "Checking…" : sport === "row" ? "Check for new rows" : "Check for suggestions"}
        </button>
        <button type="button" className={clinicStyles.buttonSecondary} style={small} onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close" : `Add a ${noun} by hand`}
        </button>
      </div>

      {showForm && (
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label className={clinicStyles.label}>
            Date
            <input type="date" className={clinicStyles.input} value={form.rowed_on} onChange={(e) => setForm({ ...form, rowed_on: e.target.value })} />
          </label>
          <label className={clinicStyles.label}>
            Distance (m)
            <input className={clinicStyles.input} inputMode="numeric" value={form.distance_m} onChange={(e) => setForm({ ...form, distance_m: e.target.value })} />
          </label>
          <label className={clinicStyles.label}>
            Minutes
            <input className={clinicStyles.input} inputMode="numeric" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} />
          </label>
          <label className={clinicStyles.label}>
            Seconds
            <input className={clinicStyles.input} inputMode="decimal" value={form.seconds} onChange={(e) => setForm({ ...form, seconds: e.target.value })} />
          </label>
          <label className={clinicStyles.label}>
            Average rate (optional)
            <input className={clinicStyles.input} inputMode="numeric" value={form.stroke_rate} onChange={(e) => setForm({ ...form, stroke_rate: e.target.value })} />
          </label>
          <label className={clinicStyles.label}>
            Average heart rate (optional)
            <input className={clinicStyles.input} inputMode="numeric" value={form.avg_hr} onChange={(e) => setForm({ ...form, avg_hr: e.target.value })} />
          </label>
          <label className={clinicStyles.label} style={{ gridColumn: "1 / -1", display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={form.is_test} onChange={(e) => setForm({ ...form, is_test: e.target.checked })} />
            {sport === "row" ? "This was a 20 minute test" : "This was a time trial or race"}
          </label>
          <button
            type="button"
            className={clinicStyles.button}
            style={{ gridColumn: "1 / -1", height: 38 }}
            disabled={busy !== null}
            onClick={() =>
              call(
                "add",
                `/api/clinic/rowing/${programmeId}/results`,
                {
                  rowed_on: form.rowed_on,
                  distance_m: Number(form.distance_m),
                  minutes: Number(form.minutes),
                  seconds: Number(form.seconds),
                  stroke_rate: form.stroke_rate ? Number(form.stroke_rate) : null,
                  avg_hr: form.avg_hr ? Number(form.avg_hr) : null,
                  is_test: form.is_test,
                },
                (d) => `${noun === "row" ? "Row" : "Run"} added.${d.suggestions ? ` ${d.suggestions} new suggestion${d.suggestions === 1 ? "" : "s"}.` : ""}`
              )
            }
          >
            {busy === "add" ? "Adding…" : "Add row"}
          </button>
        </div>
      )}

      {message && <p className={clinicStyles.notice}>{message}</p>}
      {error && <div className={clinicStyles.error} style={{ marginTop: 10 }}>{error}</div>}
    </div>
  );
}
