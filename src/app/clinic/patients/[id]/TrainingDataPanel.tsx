import { supabaseAdmin } from "@/lib/supabaseAdmin";
import clinicStyles from "../../clinic.module.css";
import { screenshotUrl } from "@/lib/trainingData";
import { twelveWeeksAgo } from "@/lib/rowing/concept2";
import CsvUploader from "@/components/training/CsvUploader";
import TestResultForm from "@/components/training/TestResultForm";
import ConfirmRemove from "@/components/training/ConfirmRemove";
import TrainingDataButton from "./TrainingDataButton";

const SPORT: Record<string, string> = { row: "Row", ski: "SkiErg", bike: "BikeErg", run: "Run" };
const SOURCE: Record<string, string> = { concept2: "Concept2", upload: "CSV upload", file: "file", manual: "typed in" };

function day(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}

function time(tenths: number): string {
  const s = tenths / 10;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = (s % 60).toFixed(1).padStart(4, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

function split(tenths: number, metres: number): string {
  return time(Math.round((tenths * 500) / metres));
}

type Session = {
  id: string;
  source: string;
  sport: string;
  rowed_on: string;
  distance_m: number;
  time_tenths: number;
  stroke_rate: number | null;
  avg_watts: number | null;
  drag_factor: number | null;
  workout_type: string | null;
};

// Synced and uploaded sessions, screenshots, and the ways to add training
// data that doesn't sync, on Dr David Silver PhD's view of a client. This
// is what the Programme Builder reads as synced_sessions.
export default async function TrainingDataPanel({ patientId, firstName }: { patientId: string; firstName: string }) {
  const since = twelveWeeksAgo();
  const [{ data: conn }, { data: sessions }, { data: shots }] = await Promise.all([
    supabaseAdmin
      .from("concept2_connections")
      .select("connected_at, last_synced_at, last_error")
      .eq("patient_id", patientId)
      .maybeSingle<{ connected_at: string; last_synced_at: string | null; last_error: string | null }>(),
    supabaseAdmin
      .from("rowing_results")
      .select("id, source, sport, rowed_on, distance_m, time_tenths, stroke_rate, avg_watts, drag_factor, workout_type")
      .eq("patient_id", patientId)
      .gte("rowed_on", since)
      .order("rowed_on", { ascending: false })
      .limit(200)
      .returns<Session[]>(),
    supabaseAdmin
      .from("training_screenshots")
      .select("id, storage_path, note, uploaded_at, seen_at")
      .eq("patient_id", patientId)
      .order("uploaded_at", { ascending: false })
      .limit(12)
      .returns<{ id: string; storage_path: string; note: string | null; uploaded_at: string; seen_at: string | null }[]>(),
  ]);

  const rows = sessions ?? [];
  const pictures = await Promise.all((shots ?? []).map(async (s) => ({ ...s, url: await screenshotUrl(s.storage_path) })));
  const unseen = pictures.filter((p) => !p.seen_at).length;
  const endpoint = `/api/clinic/patients/${patientId}/training-data`;
  const metres = rows.reduce((acc, r) => acc + r.distance_m, 0);

  const cell = { padding: "3px 5px", textAlign: "left" as const, whiteSpace: "nowrap" as const };

  return (
    <div className={clinicStyles.card}>
      <div className={clinicStyles.cardTitle}>Training data{unseen ? ` (${unseen} new screenshot${unseen === 1 ? "" : "s"})` : ""}</div>

      <p style={{ fontSize: 13.5, lineHeight: 1.5, margin: "0 0 8px" }}>
        Concept2 Logbook:{" "}
        {conn
          ? `linked ${when(conn.connected_at)}, ${conn.last_synced_at ? `last read ${when(conn.last_synced_at)}` : "not read yet"}`
          : "not linked"}
        {conn?.last_error ? `. The last read didn't work: ${conn.last_error}` : ""}
      </p>
      {conn && <TrainingDataButton endpoint={endpoint} action="sync_concept2" label="Fetch Concept2 sessions now" />}

      <p style={{ fontSize: 13.5, lineHeight: 1.5, margin: "10px 0 6px" }}>
        {rows.length
          ? `${rows.length} session${rows.length === 1 ? "" : "s"} in the last 12 weeks, ${(metres / 1000).toFixed(1)} km in all.`
          : `Nothing synced or uploaded for ${firstName} in the last 12 weeks.`}
      </p>
      {rows.length > 0 && (
        <details style={{ fontSize: 12.5 }}>
          <summary style={{ cursor: "pointer" }}>Show the sessions</summary>
          <div style={{ overflowX: "auto", marginTop: 4 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Date", "Machine", "Session", "Metres", "Time", "/500m", "Watts", "Rate", "Drag", "From", ""].map((h) => (
                    <th key={h} style={cell}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--cream)" }}>
                    <td style={cell}>{day(r.rowed_on)}</td>
                    <td style={cell}>{SPORT[r.sport] ?? r.sport}</td>
                    <td style={cell}>{r.workout_type ?? ""}</td>
                    <td style={cell}>{r.distance_m}</td>
                    <td style={cell}>{time(r.time_tenths)}</td>
                    <td style={cell}>{r.sport === "row" || r.sport === "ski" ? split(r.time_tenths, r.distance_m) : ""}</td>
                    <td style={cell}>
                      {r.avg_watts ??
                        (r.sport === "row" || r.sport === "ski" ? Math.round(2.8 / Math.pow(r.time_tenths / 10 / r.distance_m, 3)) : "")}
                    </td>
                    <td style={cell}>{r.stroke_rate ?? ""}</td>
                    <td style={cell}>{r.drag_factor ?? ""}</td>
                    <td style={cell}>{SOURCE[r.source] ?? r.source}</td>
                    <td style={cell}>
                      {(r.source === "upload" || r.source === "manual") && (
                        <ConfirmRemove endpoint={endpoint} body={{ action: "delete_session", id: r.id }} question="Remove?" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {pictures.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Screenshots from {firstName}</div>
          {unseen > 0 && <TrainingDataButton endpoint={endpoint} action="screenshots_seen" label="Mark all as seen" />}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6 }}>
            {pictures.map((p) => (
              <div key={p.id} style={{ width: 130, fontSize: 12 }}>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={`Screenshot from ${firstName}`} style={{ width: 130, height: 100, objectFit: "cover", borderRadius: 6 }} />
                  </a>
                )}
                <div>
                  {!p.seen_at && <b>New · </b>}
                  {when(p.uploaded_at)}
                </div>
                {p.note && <div style={{ fontStyle: "italic" }}>{p.note}</div>}
                <ConfirmRemove endpoint={endpoint} body={{ action: "delete_screenshot", id: p.id }} question="Remove?" />
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12.5, margin: "6px 0 0" }}>Add the numbers that matter as a test result below; nothing is read from the pictures automatically.</p>
        </div>
      )}

      <details style={{ marginTop: 12, fontSize: 13.5 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Upload a logbook export (CSV)</summary>
        <div style={{ marginTop: 8 }}>
          <CsvUploader endpoint={endpoint} buttonClass={clinicStyles.button} secondaryClass={clinicStyles.buttonSecondary} />
        </div>
      </details>
      <details style={{ marginTop: 8, fontSize: 13.5 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Add a test or race</summary>
        <div style={{ marginTop: 8 }}>
          <TestResultForm endpoint={endpoint} buttonClass={clinicStyles.button} />
        </div>
      </details>
    </div>
  );
}
