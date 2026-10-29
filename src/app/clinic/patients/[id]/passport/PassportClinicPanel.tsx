"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../../clinic.module.css";
import {
  PASSPORT_DOMAINS,
  STATUS_STYLE,
  formatValue,
  rangeStatus,
  timepointLabel,
  type PassportMarker,
  type PassportResult,
} from "@/lib/passport";

type Props = {
  patientId: string;
  clientName: string;
  initialEnabled: boolean;
  markers: PassportMarker[];
  results: PassportResult[];
  // Show only these passport areas, as each arm of Client profile does.
  domains?: readonly string[];
};

const smallButton = { width: "auto", padding: "0 14px", height: 32, fontSize: 13 } as const;

export default function PassportClinicPanel({ patientId, clientName, initialEnabled, markers, results: allResults, domains }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const markerByKey = useMemo(() => new Map(markers.map((m) => [m.marker_key, m])), [markers]);
  const results = domains ? allResults.filter((r) => domains.includes(markerByKey.get(r.marker_key)?.domain ?? "")) : allResults;
  const drafts = results.filter((r) => r.status === "draft");

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch(`/api/clinic/patients/${patientId}/passport`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      if (res.ok) {
        setEnabled(!enabled);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function upload(dropped?: File) {
    const file = dropped ?? fileRef.current?.files?.[0];
    if (!file) {
      setUploadMessage("Choose the filled in template first.");
      return;
    }
    setBusy(true);
    setProblems([]);
    setUploadMessage(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/clinic/patients/${patientId}/passport/upload`, { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setUploadMessage(json.error ?? "Upload failed.");
        setProblems(json.problems ?? []);
        return;
      }
      setUploadMessage(`${json.saved} result${json.saved === 1 ? "" : "s"} saved as drafts, ready for your notes.`);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function releaseAll() {
    if (!confirm(`Release all ${drafts.length} drafts to ${clientName}? They will appear on their My Passport straight away.`)) return;
    setBusy(true);
    try {
      for (const r of drafts) {
        await fetch(`/api/clinic/passport/results/${r.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "released" }),
        });
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <div className={clinicStyles.card}>
          <div className={clinicStyles.cardTitle}>My Passport for {clientName}</div>
          <p className={clinicStyles.notice} style={{ marginTop: 0 }}>
            When this is on, {clientName} sees a My Passport tab in the app showing only released results.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className={`${clinicStyles.statusPill} ${enabled ? clinicStyles.statusActive : clinicStyles.statusNoProgramme}`}>
              {enabled ? "On" : "Off"}
            </span>
            <button type="button" onClick={toggle} disabled={busy} className={clinicStyles.buttonSecondary} style={smallButton}>
              {enabled ? "Turn off" : "Turn on"}
            </button>
          </div>
        </div>

        <div className={clinicStyles.card}>
          <div className={clinicStyles.cardTitle}>Upload results</div>
          <p className={clinicStyles.notice} style={{ marginTop: 0 }}>
            Fill in the template in Excel or Google Sheets, save it as CSV, then upload it here. Every row arrives as a draft.
          </p>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void upload(f);
            }}
            style={{
              border: `2px dashed ${dragOver ? "var(--crimson)" : "var(--mist)"}`,
              background: dragOver ? "var(--crimson-light)" : "transparent",
              borderRadius: 12,
              padding: "16px",
              textAlign: "center",
              fontSize: 13.5,
              color: "var(--graphite)",
              marginBottom: 10,
            }}
          >
            {busy ? "Reading the file" : "Drop the filled in template (CSV) here"}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <a
              href="/api/clinic/passport/template"
              className={clinicStyles.buttonSecondary}
              style={{ ...smallButton, display: "inline-flex", alignItems: "center", textDecoration: "none" }}
            >
              Download template
            </a>
            <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ fontSize: 13 }} />
            <button type="button" onClick={() => upload()} disabled={busy} className={clinicStyles.buttonSecondary} style={smallButton}>
              {busy ? "Working" : "Upload"}
            </button>
          </div>
          {uploadMessage && <p className={clinicStyles.notice}>{uploadMessage}</p>}
          {problems.length > 0 && (
            <ul style={{ fontSize: 12.5, color: "var(--amber)", margin: "6px 0 0", paddingLeft: 18 }}>
              {problems.slice(0, 20).map((p) => (
                <li key={p}>{p}</li>
              ))}
              {problems.length > 20 && <li>and {problems.length - 20} more</li>}
            </ul>
          )}
        </div>
      </div>

      {drafts.length > 0 && (
        <div className={clinicStyles.card} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 14 }}>
            {drafts.length} draft{drafts.length === 1 ? "" : "s"} waiting. Add notes where they help, then release.
          </div>
          <button type="button" onClick={releaseAll} disabled={busy} className={clinicStyles.buttonSecondary} style={smallButton}>
            Release all drafts
          </button>
        </div>
      )}

      {results.length === 0 && (
        <p className={clinicStyles.notice} style={{ color: "var(--clinic-on-canvas-muted)" }}>
          {domains ? "No results in this area yet. Results for it arrive through the same template, alongside everything else in the passport." : "No results yet. Download the template, fill it in and upload it to begin."}
        </p>
      )}

      {PASSPORT_DOMAINS.filter((d) => !domains || domains.includes(d.key)).map((d) => {
        const own = results.filter((r) => markerByKey.get(r.marker_key)?.domain === d.key);
        if (own.length === 0) return null;
        const byMarker = new Map<string, PassportResult[]>();
        for (const r of own) byMarker.set(r.marker_key, [...(byMarker.get(r.marker_key) ?? []), r]);
        return (
          <div key={d.key} className={clinicStyles.card} style={{ borderLeft: `4px solid ${d.colour}` }}>
            <div className={clinicStyles.cardTitle}>{d.name}</div>
            {Array.from(byMarker.entries()).map(([key, list]) => {
              const m = markerByKey.get(key)!;
              return <MarkerBlock key={key} marker={m} results={list} />;
            })}
          </div>
        );
      })}
    </>
  );
}

function MarkerBlock({ marker, results }: { marker: PassportMarker; results: PassportResult[] }) {
  const router = useRouter();
  const [explanation, setExplanation] = useState(marker.explanation ?? "");
  const [savedExplanation, setSavedExplanation] = useState(marker.explanation ?? "");

  async function saveExplanation() {
    const res = await fetch(`/api/clinic/passport/markers/${encodeURIComponent(marker.marker_key)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ explanation }),
    });
    if (res.ok) {
      setSavedExplanation(explanation);
      router.refresh();
    }
  }

  const ranges = [
    marker.range_low != null || marker.range_high != null ? `Healthy ${fmtRange(marker.range_low, marker.range_high)}` : null,
    marker.optimal_low != null || marker.optimal_high != null ? `Optimal ${fmtRange(marker.optimal_low, marker.optimal_high)}` : null,
  ].filter(Boolean);

  return (
    <div style={{ borderTop: "1px solid var(--mist)", padding: "12px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14.5 }}>
            {marker.name}
            {marker.panel && <span style={{ fontWeight: 400, color: "var(--graphite)" }}> · {marker.panel}</span>}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--graphite)" }}>
            {marker.unit ?? "No unit"}
            {ranges.length > 0 && `, ${ranges.join(", ")}`}
            {`, better when ${marker.better === "in_range" ? "within range" : marker.better}`}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 8 }}>
        <label className={clinicStyles.label} style={{ fontSize: 12 }}>
          Plain English explanation, shown to every client with this marker
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className={clinicStyles.input}
            style={{ fontSize: 13.5, padding: "6px 10px" }}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="What this marker is and why it matters, in a sentence or two"
          />
          <button
            type="button"
            className={clinicStyles.buttonSecondary}
            style={smallButton}
            disabled={explanation === savedExplanation}
            onClick={saveExplanation}
          >
            Save
          </button>
        </div>
      </div>
      {results.map((r) => (
        <ResultRow key={r.id} marker={marker} result={r} />
      ))}
    </div>
  );
}

function ResultRow({ marker, result }: { marker: PassportMarker; result: PassportResult }) {
  const router = useRouter();
  const [note, setNote] = useState(result.clinician_note ?? "");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(result.value));
  const [takenOn, setTakenOn] = useState(result.taken_on);
  const [timepoint, setTimepoint] = useState<string>(result.timepoint);
  const [editError, setEditError] = useState<string | null>(null);
  const status = rangeStatus(Number(result.value), marker);
  const s = STATUS_STYLE[status];
  const released = result.status === "released";

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch(`/api/clinic/passport/results/${result.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    const n = Number(value);
    if (value.trim() === "" || !Number.isFinite(n)) {
      setEditError("Please enter a number.");
      return;
    }
    setBusy(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/clinic/passport/results/${result.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: n, taken_on: takenOn, timepoint }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditError(data.error ?? "That did not save.");
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this result? This cannot be undone.")) return;
    setBusy(true);
    try {
      await fetch(`/api/clinic/passport/results/${result.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(170px, 220px) 1fr auto", gap: 10, alignItems: "start", marginTop: 10 }}>
      <div style={{ fontSize: 13 }}>
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                aria-label="Value"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className={clinicStyles.input}
                style={{ width: 90, fontSize: 14, padding: "4px 8px" }}
              />
              <span>{marker.unit}</span>
            </div>
            <input
              aria-label="Date"
              type="date"
              value={takenOn}
              onChange={(e) => setTakenOn(e.target.value)}
              className={clinicStyles.input}
              style={{ fontSize: 13, padding: "4px 8px" }}
            />
            <select
              aria-label="Timepoint"
              value={timepoint}
              onChange={(e) => setTimepoint(e.target.value)}
              className={clinicStyles.input}
              style={{ fontSize: 13, padding: "4px 8px" }}
            >
              <option value="baseline">Baseline</option>
              <option value="month_3">3 months</option>
              <option value="month_6">6 months</option>
              <option value="review">Review</option>
            </select>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" disabled={busy} className={clinicStyles.buttonSecondary} style={{ ...smallButton, height: 28 }} onClick={saveEdit}>
                Save
              </button>
              <button type="button" className={clinicStyles.buttonSecondary} style={{ ...smallButton, height: 28 }} onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
            {editError && <div style={{ color: "var(--amber)" }}>{editError}</div>}
          </div>
        ) : (
          <>
            <div>
              <strong style={{ fontSize: 15 }}>{formatValue(Number(result.value))}</strong> {marker.unit}{" "}
              <button
                type="button"
                onClick={() => setEditing(true)}
                style={{ background: "none", border: "none", padding: 0, color: "var(--crimson)", textDecoration: "underline", cursor: "pointer", fontSize: 12.5 }}
              >
                Edit
              </button>
            </div>
            <div style={{ color: "var(--graphite)" }}>
              {timepointLabel(result.timepoint)}, {result.taken_on}
              {result.source && `, ${result.source}`}
            </div>
          </>
        )}
        <span style={{ display: "inline-block", marginTop: 4, fontSize: 11.5, fontWeight: 600, padding: "2px 8px", borderRadius: 20, color: s.colour, background: s.soft }}>
          {s.label}
        </span>{" "}
        <span style={{ display: "inline-block", marginTop: 4, fontSize: 11.5, fontWeight: 600, padding: "2px 8px", borderRadius: 20, color: released ? "#2e6f5c" : "#565f6b", background: released ? "#e5f0ec" : "#eef0f3" }}>
          {released ? "Released" : "Draft"}
        </span>
      </div>
      <textarea
        className={clinicStyles.textarea}
        style={{ minHeight: 60, fontFamily: "var(--font-inter), sans-serif", fontSize: 13.5 }}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => note !== (result.clinician_note ?? "") && patch({ clinician_note: note })}
        placeholder="Note for the client, for example what this means for them and what we will do about it"
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button
          type="button"
          disabled={busy}
          className={clinicStyles.buttonSecondary}
          style={smallButton}
          onClick={() => patch({ clinician_note: note, status: released ? "draft" : "released" })}
        >
          {released ? "Back to draft" : "Release"}
        </button>
        <button type="button" disabled={busy} className={clinicStyles.buttonSecondary} style={{ ...smallButton, color: "var(--graphite)" }} onClick={remove}>
          Delete
        </button>
      </div>
    </div>
  );
}

function fmtRange(lo: number | null, hi: number | null) {
  if (lo != null && hi != null) return `${formatValue(lo)} to ${formatValue(hi)}`;
  if (lo != null) return `above ${formatValue(lo)}`;
  return `below ${formatValue(hi!)}`;
}
