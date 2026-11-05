import { supabaseAdmin } from "@/lib/supabaseAdmin";
import clinicStyles from "../../clinic.module.css";
import { whenText, workoutLine } from "@/lib/workoutDisplay";
import { formatDuration } from "@/lib/rowing/zones";
import MarkUploadsRead from "./MarkUploadsRead";

type Lap = { n: number; seconds: number; distanceM: number | null; avgHr: number | null; avgPower: number | null; avgCadence: number | null };

type Row = {
  id: string;
  sport: string;
  sport_label: string;
  started_at: string;
  duration_seconds: number;
  distance_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_power: number | null;
  max_power: number | null;
  avg_cadence: number | null;
  calories: number | null;
  device: string | null;
  laps: Lap[];
  note: string | null;
  rowing_result_id: string | null;
  read_at: string | null;
  uploaded_at: string;
};

// Workout files the client has uploaded from their Me page, newest first,
// with the numbers read from each file and its laps on request. Rows and
// runs are also in the Rowing card, where the plans read them.
export default async function UploadedWorkoutsPanel({ patientId, firstName }: { patientId: string; firstName: string }) {
  const { data } = await supabaseAdmin
    .from("uploaded_workouts")
    .select("id, sport, sport_label, started_at, duration_seconds, distance_m, avg_hr, max_hr, avg_power, max_power, avg_cadence, calories, device, laps, note, rowing_result_id, read_at, uploaded_at")
    .eq("patient_id", patientId)
    .order("started_at", { ascending: false })
    .limit(12)
    .returns<Row[]>();
  const rows = data ?? [];
  if (rows.length === 0) return null;
  const unread = rows.filter((r) => !r.read_at).length;

  return (
    <div className={clinicStyles.card}>
      <div className={clinicStyles.cardTitle}>Uploaded workouts{unread ? ` (${unread} new)` : ""}</div>
      {unread > 0 && <MarkUploadsRead patientId={patientId} />}
      {rows.map((r) => (
        <div key={r.id} style={{ padding: "8px 0", borderTop: "1px solid var(--cream)" }}>
          <div style={{ fontSize: 13.5 }}>
            {!r.read_at && <b>New · </b>}
            <b>{r.sport_label}</b>, {whenText(r.started_at)}
            {r.device ? <span style={{ color: "var(--muted)" }}>, {r.device}</span> : null}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>{workoutLine(r)}</div>
          {r.note && <div style={{ fontSize: 13, fontStyle: "italic", lineHeight: 1.5 }}>{firstName}: {r.note}</div>}
          {r.rowing_result_id && <div style={{ fontSize: 12, color: "var(--muted)" }}>Also counted in the Rowing and Running plan readings.</div>}
          {r.laps.length > 1 && (
            <details style={{ fontSize: 12.5, marginTop: 4 }}>
              <summary style={{ cursor: "pointer" }}>{r.laps.length} laps</summary>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 4 }}>
                <thead>
                  <tr>
                    {["Lap", "Time", "Distance", "HR", "Power", "Cadence"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: 3 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.laps.map((l) => (
                    <tr key={l.n}>
                      <td style={{ padding: 3 }}>{l.n}</td>
                      <td style={{ padding: 3 }}>{formatDuration(l.seconds)}</td>
                      <td style={{ padding: 3 }}>{l.distanceM ? `${l.distanceM}m` : ""}</td>
                      <td style={{ padding: 3 }}>{l.avgHr ?? ""}</td>
                      <td style={{ padding: 3 }}>{l.avgPower ? `${l.avgPower} W` : ""}</td>
                      <td style={{ padding: 3 }}>{l.avgCadence ? (r.sport === "run" ? l.avgCadence * 2 : l.avgCadence) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}
