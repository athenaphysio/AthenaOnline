import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import sessionStyles from "../TodaySession.module.css";
import { whenText, workoutLine } from "@/lib/workoutDisplay";
import WorkoutUploader from "./WorkoutUploader";
import RemoveWorkoutButton from "./RemoveWorkoutButton";
import ClientTabBar from "../ClientTabBar";

export const dynamic = "force-dynamic";

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
  avg_cadence: number | null;
  device: string | null;
};

// Where a client drops in a workout file from any device or app, whenever
// it suits them, so Dr David Silver PhD can see how the session went.
export default async function WorkoutsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/start");

  const { data: rows } = await supabase
    .from("uploaded_workouts")
    .select("id, sport, sport_label, started_at, duration_seconds, distance_m, avg_hr, max_hr, avg_power, avg_cadence, device")
    .eq("patient_id", user.id)
    .order("started_at", { ascending: false })
    .limit(20)
    .returns<Row[]>();

  return (
    <div className={sessionStyles.app}>
      <div className={sessionStyles.inner}>
        <div className={sessionStyles.head}>
          <h1>Add a workout file</h1>
          <p>
            Upload a session from your Wattbike, watch, Zwift or any other app that saves a workout file, and its numbers reach Dr David
            Silver PhD with your programme. Add as many as you like, whenever you get a chance.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 22px 32px" }}>
          <WorkoutUploader />

          <details style={{ fontSize: 14, lineHeight: 1.55 }}>
            <summary style={{ cursor: "pointer", fontWeight: 500 }}>How do I get the file?</summary>
            <p style={{ margin: "8px 0" }}>
              Most apps and devices can save a finished session as a <b>.FIT</b> file. Open the session, look for <b>Export</b>,{" "}
              <b>Download</b> or <b>Share</b>, and choose FIT if you are given a choice. Save it to your phone or computer, then upload it here.
            </p>
            <p style={{ margin: "8px 0" }}>
              <b>Garmin:</b> on the Garmin Connect website, open the activity, tap the settings cog and choose <b>Export Original</b>. It
              downloads as a .zip, which you can upload exactly as it is.
            </p>
            <p style={{ margin: "8px 0" }}>
              If you can&apos;t find an export option, send Dr David Silver PhD a message and he will help you find it.
            </p>
          </details>

          {(rows ?? []).length > 0 && (
            <div>
              <h2 style={{ fontSize: 17, margin: "6px 0" }}>Your uploads</h2>
              {(rows ?? []).map((r) => (
                <div key={r.id} style={{ padding: "10px 0", borderTop: "1px solid rgba(127,127,127,0.25)" }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    {r.sport_label}, {whenText(r.started_at)}
                  </div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 2 }}>{workoutLine(r)}</div>
                  <RemoveWorkoutButton id={r.id} />
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 18, fontSize: 14 }}>
            <Link href="/session">Back to your programme</Link>
            <Link href="/session/me">Back to Me</Link>
          </div>
        </div>
      </div>
      <ClientTabBar userId={user.id} />
    </div>
  );
}
