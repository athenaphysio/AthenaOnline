"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type PreviewRow = {
  date: string;
  sport: string;
  workoutType: string | null;
  distanceM: number;
  timeTenths: number;
  avgWatts: number | null;
  strokeRate: number | null;
  dragFactor: number | null;
  duplicate: boolean;
};

const SPORT: Record<string, string> = { row: "Row", ski: "SkiErg", bike: "BikeErg", run: "Run" };

function time(tenths: number): string {
  const s = tenths / 10;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = (s % 60).toFixed(1).padStart(4, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

function day(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Upload a CSV export (the Concept2 online logbook's, for example). The
// file is read first and shown as a list, with anything already here
// marked, and nothing is saved until the person confirms.
export default function CsvUploader({ endpoint, buttonClass, secondaryClass }: { endpoint: string; buttonClass: string; secondaryClass?: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(body: Record<string, unknown>) {
    const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
    return data;
  }

  async function choose(file: File | undefined) {
    setRows(null);
    setMessage(null);
    setError(null);
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setError("That file is larger than 3MB. Please export a shorter date range.");
      return;
    }
    const text = await file.text();
    setCsv(text);
    setBusy(true);
    try {
      const data = await post({ action: "csv_preview", csv: text });
      setRows(data.rows);
      setSkipped(data.skipped ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setCsv(null);
    setRows(null);
    if (input.current) input.current.value = "";
  }

  async function save() {
    if (!csv) return;
    setBusy(true);
    setError(null);
    try {
      const data = await post({ action: "csv_save", csv });
      setMessage(
        data.added === 0
          ? "Everything in that file was already here, so nothing new was added."
          : `${data.added} session${data.added === 1 ? "" : "s"} added${data.alreadyHere ? `, and ${data.alreadyHere} already here were left as they were` : ""}.`
      );
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const fresh = rows?.filter((r) => !r.duplicate).length ?? 0;
  const cell = { padding: "4px 6px", textAlign: "left" as const, whiteSpace: "nowrap" as const };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input ref={input} type="file" accept=".csv,text/csv" onChange={(e) => choose(e.target.files?.[0])} style={{ fontSize: 14 }} />
      {busy && !rows && <p style={{ margin: 0, fontSize: 14 }}>Reading the file…</p>}
      {rows && (
        <>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            {fresh === 0
              ? "Every session in this file is already here, so there is nothing new to add."
              : `${fresh} new session${fresh === 1 ? "" : "s"} will be added.`}
            {rows.length - fresh > 0 ? ` ${rows.length - fresh} already here will be skipped (shown faded).` : ""}
            {skipped > 0 ? ` ${skipped} line${skipped === 1 ? "" : "s"} without a date, distance and time couldn't be read.` : ""}
          </p>
          <div style={{ overflowX: "auto", maxHeight: 320, overflowY: "auto", border: "1px solid rgba(127,127,127,0.25)", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Date", "Machine", "Session", "Metres", "Time", "Watts", "Rate", "Drag"].map((h) => (
                    <th key={h} style={cell}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ opacity: r.duplicate ? 0.45 : 1, borderTop: "1px solid rgba(127,127,127,0.18)" }}>
                    <td style={cell}>{day(r.date)}</td>
                    <td style={cell}>{SPORT[r.sport] ?? r.sport}</td>
                    <td style={cell}>{r.workoutType ?? ""}</td>
                    <td style={cell}>{r.distanceM}</td>
                    <td style={cell}>{time(r.timeTenths)}</td>
                    <td style={cell}>{r.avgWatts ?? ""}</td>
                    <td style={cell}>{r.strokeRate ?? ""}</td>
                    <td style={cell}>{r.dragFactor ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className={buttonClass} disabled={busy || fresh === 0} onClick={save} style={{ width: "auto", padding: "0 18px" }}>
              {busy ? "Saving…" : `Add ${fresh} session${fresh === 1 ? "" : "s"}`}
            </button>
            <button type="button" className={secondaryClass ?? buttonClass} disabled={busy} onClick={reset} style={{ width: "auto", padding: "0 18px" }}>
              Cancel
            </button>
          </div>
        </>
      )}
      {message && <p style={{ margin: 0, fontSize: 14 }}>{message}</p>}
      {error && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{error}</p>}
    </div>
  );
}
