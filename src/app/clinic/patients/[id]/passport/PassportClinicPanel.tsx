"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../../clinic.module.css";
import {
  PASSPORT_DOMAINS,
  STATUS_STYLE,
  formatValue,
  displayValue,
  rangeStatus,
  rangesFor,
  timepointLabel,
  targetLabel,
  type PassportMarker,
  type PassportResult,
  type PassportTarget,
} from "@/lib/passport";

type Props = {
  patientId: string;
  clientName: string;
  initialEnabled: boolean;
  markers: PassportMarker[];
  results: PassportResult[];
  // Show only these passport areas, as each arm of Client profile does.
  domains?: readonly string[];
  // Multidisciplinary sign-offs, one per test date.
  signoffs?: { taken_on: string; meeting_on: string; clinicians: string; note: string | null }[];
  // This client's targets, one per marker at most.
  targets?: PassportTarget[];
};

const smallButton = { width: "auto", padding: "0 14px", height: 32, fontSize: 13 } as const;

export default function PassportClinicPanel({ patientId, clientName, initialEnabled, markers, results: allResults, domains, signoffs = [], targets = [] }: Props) {
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
  const targetByKey = useMemo(() => new Map(targets.map((t) => [t.marker_key, t])), [targets]);
  const signedDates = useMemo(() => new Set(signoffs.map((s) => s.taken_on)), [signoffs]);
  const releasable = drafts.filter((r) => signedDates.has(r.taken_on));
  const testDates = Array.from(new Set(results.map((r) => r.taken_on))).sort().reverse();

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
    if (!confirm(`Release ${releasable.length} signed off draft${releasable.length === 1 ? "" : "s"} to ${clientName}? They will appear on their My Passport straight away.`)) return;
    setBusy(true);
    try {
      for (const r of releasable) {
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

      {testDates.length > 0 && <SignoffCard patientId={patientId} testDates={testDates} signoffs={signoffs} results={results} />}

      {drafts.length > 0 && (
        <div className={clinicStyles.card} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 14 }}>
            {drafts.length} draft{drafts.length === 1 ? "" : "s"} waiting.{" "}
            {releasable.length === drafts.length
              ? "All are signed off. Add notes where they help, then release."
              : releasable.length > 0
                ? `${releasable.length} are signed off and can be released; the rest wait for their multidisciplinary sign-off.`
                : "None can be released until their test date is signed off at a multidisciplinary meeting."}
          </div>
          <button type="button" onClick={releaseAll} disabled={busy || releasable.length === 0} className={clinicStyles.buttonSecondary} style={smallButton}>
            Release signed off drafts
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
              return (
                <MarkerBlock key={key} patientId={patientId} marker={m} results={list} signedDates={signedDates} target={targetByKey.get(key) ?? null} />
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function MarkerBlock({
  patientId,
  marker,
  results,
  signedDates,
  target,
}: {
  patientId: string;
  marker: PassportMarker;
  results: PassportResult[];
  signedDates: Set<string>;
  target: PassportTarget | null;
}) {
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
    marker.range_low != null || marker.range_high != null ? `default range ${fmtRange(marker.range_low, marker.range_high)}` : null,
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
      <TargetEditor patientId={patientId} marker={marker} target={target} hasReleasedResult={results.some((r) => r.status === "released")} />
      {results.map((r) => (
        <ResultRow key={r.id} marker={marker} result={r} signedOff={signedDates.has(r.taken_on)} />
      ))}
    </div>
  );
}

function ResultRow({ marker, result, signedOff }: { marker: PassportMarker; result: PassportResult; signedOff: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState(result.clinician_note ?? "");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(result.value));
  const [takenOn, setTakenOn] = useState(result.taken_on);
  const [timepoint, setTimepoint] = useState<string>(result.timepoint);
  const [editError, setEditError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const ranges = rangesFor(marker, result);
  const [rangeLow, setRangeLow] = useState(ranges.range_low == null ? "" : String(ranges.range_low));
  const [rangeHigh, setRangeHigh] = useState(ranges.range_high == null ? "" : String(ranges.range_high));
  const status = rangeStatus(Number(result.value), ranges);
  const s = STATUS_STYLE[status];
  const released = result.status === "released";

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/clinic/passport/results/${result.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error ?? "That did not save.");
      }
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
    const lo = rangeLow.trim() === "" ? null : Number(rangeLow);
    const hi = rangeHigh.trim() === "" ? null : Number(rangeHigh);
    if ((lo != null && !Number.isFinite(lo)) || (hi != null && !Number.isFinite(hi))) {
      setEditError("Range limits must be numbers, or left empty.");
      return;
    }
    setBusy(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/clinic/passport/results/${result.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: n, taken_on: takenOn, timepoint, range_low: lo, range_high: hi }),
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
            <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5 }}>
              <span>Range for this client</span>
              <input
                aria-label="Range low"
                inputMode="decimal"
                value={rangeLow}
                onChange={(e) => setRangeLow(e.target.value)}
                className={clinicStyles.input}
                style={{ width: 64, fontSize: 13, padding: "4px 6px" }}
                placeholder="low"
              />
              <span>to</span>
              <input
                aria-label="Range high"
                inputMode="decimal"
                value={rangeHigh}
                onChange={(e) => setRangeHigh(e.target.value)}
                className={clinicStyles.input}
                style={{ width: 64, fontSize: 13, padding: "4px 6px" }}
                placeholder="high"
              />
            </div>
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
              <strong style={{ fontSize: 15 }}>{displayValue(result)}</strong> {marker.unit}{" "}
              <button
                type="button"
                onClick={() => setEditing(true)}
                style={{ background: "none", border: "none", padding: 0, color: "var(--crimson-text, var(--crimson))", textDecoration: "underline", cursor: "pointer", fontSize: 12.5 }}
              >
                Edit
              </button>
            </div>
            <div style={{ color: "var(--graphite)" }}>
              {timepointLabel(result.timepoint)}, {result.taken_on}
              {result.source && `, ${result.source}`}
            </div>
            <div style={{ color: "var(--graphite)" }}>
              {ranges.range_low != null || ranges.range_high != null
                ? `Range for this client ${fmtRange(ranges.range_low, ranges.range_high)}`
                : "No range for this client"}
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
          disabled={busy || (!released && !signedOff)}
          title={!released && !signedOff ? "Sign off this test date at a multidisciplinary meeting first" : undefined}
          className={clinicStyles.buttonSecondary}
          style={smallButton}
          onClick={() => patch({ clinician_note: note, status: released ? "draft" : "released" })}
        >
          {released ? "Back to draft" : signedOff ? "Release" : "Awaiting sign-off"}
        </button>
        {actionError && <div style={{ color: "var(--amber)", fontSize: 12, maxWidth: 160 }}>{actionError}</div>}
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

// One row per test date: whether it has been signed off at a
// multidisciplinary meeting, and the form to record that it has. Results
// from a date cannot be released until this is done.
function SignoffCard({
  patientId,
  testDates,
  signoffs,
  results,
}: {
  patientId: string;
  testDates: string[];
  signoffs: { taken_on: string; meeting_on: string; clinicians: string; note: string | null }[];
  results: PassportResult[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [meetingOn, setMeetingOn] = useState(new Date().toISOString().slice(0, 10));
  const [clinicians, setClinicians] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const byDate = new Map(signoffs.map((s) => [s.taken_on, s]));

  async function send(method: "POST" | "DELETE", body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clinic/patients/${patientId}/passport/signoffs`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "That did not save.");
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={clinicStyles.card}>
      <div className={clinicStyles.cardTitle}>Multidisciplinary sign-off</div>
      <p className={clinicStyles.notice} style={{ marginTop: 0 }}>
        Results stay as drafts until the clinicians reviewing them at a multidisciplinary meeting have signed off that test date.
      </p>
      {testDates.map((d) => {
        const s = byDate.get(d);
        const count = results.filter((r) => r.taken_on === d).length;
        return (
          <div key={d} style={{ borderTop: "1px solid var(--mist)", padding: "10px 0", fontSize: 13.5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span>
                <strong>Tests taken {d}</strong>, {count} result{count === 1 ? "" : "s"}
                {s ? `. Signed off on ${s.meeting_on} by ${s.clinicians}.` : ". Not signed off yet."}
              </span>
              {s ? (
                <button
                  type="button"
                  disabled={busy}
                  className={clinicStyles.buttonSecondary}
                  style={smallButton}
                  onClick={() => {
                    if (confirm(`Withdraw the sign-off for ${d}? Any results from that date already released go back to draft.`)) void send("DELETE", { taken_on: d });
                  }}
                >
                  Withdraw sign-off
                </button>
              ) : (
                <button type="button" className={clinicStyles.buttonSecondary} style={smallButton} onClick={() => setOpen(open === d ? null : d)}>
                  {open === d ? "Close" : "Record sign-off"}
                </button>
              )}
            </div>
            {s?.note && <div style={{ color: "var(--graphite)", marginTop: 4 }}>{s.note}</div>}
            {open === d && !s && (
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                <label className={clinicStyles.label} style={{ fontSize: 12 }}>
                  Date of the meeting
                  <input type="date" className={clinicStyles.input} value={meetingOn} onChange={(e) => setMeetingOn(e.target.value)} />
                </label>
                <label className={clinicStyles.label} style={{ fontSize: 12 }}>
                  Clinicians who signed off, with their roles
                  <input
                    className={clinicStyles.input}
                    value={clinicians}
                    onChange={(e) => setClinicians(e.target.value)}
                    placeholder="For example Prof Syed Haq (physician), Dr David Silver PhD (physiotherapist)"
                  />
                </label>
                <label className={clinicStyles.label} style={{ fontSize: 12 }}>
                  Note for the record (optional)
                  <input className={clinicStyles.input} value={note} onChange={(e) => setNote(e.target.value)} />
                </label>
                <div>
                  <button
                    type="button"
                    disabled={busy}
                    className={clinicStyles.buttonSecondary}
                    style={smallButton}
                    onClick={async () => {
                      if (await send("POST", { taken_on: d, meeting_on: meetingOn, clinicians, note })) {
                        setOpen(null);
                        setClinicians("");
                        setNote("");
                      }
                    }}
                  >
                    Save sign-off
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {error && <p className={clinicStyles.notice} style={{ color: "var(--amber)" }}>{error}</p>}
    </div>
  );
}

// One client's target for one marker: drawn as a dashed line on their
// chart. Saving puts it back to draft; it can be released once a result for
// this marker has been released.
function TargetEditor({
  patientId,
  marker,
  target,
  hasReleasedResult,
}: {
  patientId: string;
  marker: PassportMarker;
  target: PassportTarget | null;
  hasReleasedResult: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [low, setLow] = useState(target?.target_low == null ? "" : String(target.target_low));
  const [high, setHigh] = useState(target?.target_high == null ? "" : String(target.target_high));
  const [by, setBy] = useState(target?.target_by ?? "");
  const [note, setNote] = useState(target?.note ?? "");
  const [source, setSource] = useState(target?.source ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const released = target?.status === "released";

  async function call(method: "PUT" | "PATCH" | "DELETE", body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clinic/patients/${patientId}/passport/targets`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marker_key: marker.marker_key, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "That did not save.");
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  const tiny = { ...smallButton, height: 28, fontSize: 12.5 };

  return (
    <div style={{ marginTop: 8, fontSize: 13 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ color: "var(--graphite)" }}>
          Target for this client:{" "}
          {target ? (
            <>
              <strong style={{ color: "var(--ink, inherit)" }}>{targetLabel(target, marker.unit)}</strong> ({released ? "released" : "draft"})
            </>
          ) : (
            "none set"
          )}
        </span>
        <button type="button" className={clinicStyles.buttonSecondary} style={tiny} onClick={() => setOpen(!open)}>
          {open ? "Close" : target ? "Edit target" : "Add target"}
        </button>
        {target && (
          <button
            type="button"
            className={clinicStyles.buttonSecondary}
            style={tiny}
            disabled={busy || (!released && !hasReleasedResult)}
            title={!released && !hasReleasedResult ? "Release a signed off result for this marker first" : undefined}
            onClick={() => call("PATCH", { status: released ? "draft" : "released" })}
          >
            {released ? "Target back to draft" : "Release target"}
          </button>
        )}
      </div>
      {open && (
        <div style={{ display: "grid", gap: 6, marginTop: 8, maxWidth: 520 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span>At or above</span>
            <input className={clinicStyles.input} style={{ width: 80, padding: "4px 8px" }} inputMode="decimal" value={low} onChange={(e) => setLow(e.target.value)} />
            <span>and/or below</span>
            <input className={clinicStyles.input} style={{ width: 80, padding: "4px 8px" }} inputMode="decimal" value={high} onChange={(e) => setHigh(e.target.value)} />
            <span>{marker.unit}</span>
          </div>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            By (optional)
            <input type="date" className={clinicStyles.input} style={{ width: 170, padding: "4px 8px" }} value={by} onChange={(e) => setBy(e.target.value)} />
          </label>
          <input
            className={clinicStyles.input}
            style={{ padding: "4px 8px" }}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Shown to the client, for example: Agreed with your care team for your week 12 review."
          />
          <input
            className={clinicStyles.input}
            style={{ padding: "4px 8px" }}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Where it came from, care team only, for example: Prof Haq report, Table 12"
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className={clinicStyles.buttonSecondary}
              style={tiny}
              disabled={busy}
              onClick={async () => {
                if (await call("PUT", { target_low: low, target_high: high, target_by: by, note, source })) setOpen(false);
              }}
            >
              Save as draft
            </button>
            {target && (
              <button
                type="button"
                className={clinicStyles.buttonSecondary}
                style={{ ...tiny, color: "var(--graphite)" }}
                disabled={busy}
                onClick={async () => {
                  if (confirm("Remove this target?") && (await call("DELETE", {}))) setOpen(false);
                }}
              >
                Remove target
              </button>
            )}
          </div>
        </div>
      )}
      {error && <div style={{ color: "var(--amber)", marginTop: 4 }}>{error}</div>}
    </div>
  );
}
