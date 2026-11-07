import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import sessionStyles from "../TodaySession.module.css";
import shopStyles from "../../shop/shop.module.css";
import ClientTabBar from "../ClientTabBar";
import CsvUploader from "@/components/training/CsvUploader";
import TestResultForm from "@/components/training/TestResultForm";
import ScreenshotUploader from "@/components/training/ScreenshotUploader";
import RemoveUploadedSession from "./RemoveUploadedSession";

export const dynamic = "force-dynamic";

const SPORT: Record<string, string> = { row: "Row", ski: "SkiErg", bike: "BikeErg", run: "Run" };

function day(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

function time(tenths: number): string {
  const s = Math.round(tenths / 10);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : `${m}:${String(s % 60).padStart(2, "0")}`;
}

// Where a client adds training that doesn't reach the app by itself: a CSV
// export of their logbook, a single test or race, or a screenshot for Dr
// David Silver PhD to read.
export default async function TrainingDataPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/start");

  const { data: uploads } = await supabase
    .from("rowing_results")
    .select("id, rowed_on, sport, distance_m, time_tenths, workout_type")
    .eq("patient_id", user.id)
    .eq("source", "upload")
    .order("rowed_on", { ascending: false })
    .limit(15)
    .returns<{ id: string; rowed_on: string; sport: string; distance_m: number; time_tenths: number; workout_type: string | null }[]>();

  const section = { display: "flex", flexDirection: "column" as const, gap: 10, paddingTop: 6 };

  return (
    <div className={sessionStyles.app}>
      <div className={sessionStyles.inner}>
        <div className={sessionStyles.head}>
          <h1>Add training data</h1>
          <p>
            Anything that doesn&apos;t reach the app by itself can be added here, so Dr David Silver PhD sees the whole picture when he
            plans your next block.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26, padding: "0 22px 32px" }}>
          <div style={section}>
            <h2 style={{ fontSize: 17, margin: 0 }}>Upload a logbook export</h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
              A CSV file of your sessions, such as the export from the Concept2 online logbook. You&apos;ll see what will be added before
              anything is saved, and sessions already here are skipped.
            </p>
            <details style={{ fontSize: 14, lineHeight: 1.55 }}>
              <summary style={{ cursor: "pointer", fontWeight: 500 }}>How do I get the Concept2 file?</summary>
              <p style={{ margin: "8px 0" }}>
                Sign in at <b>log.concept2.com</b> on a computer, open <b>History</b>, choose the season, and use the <b>Export</b> link to
                download it as a CSV file. Then upload that file here.
              </p>
            </details>
            <CsvUploader endpoint="/api/session/training-data" buttonClass={shopStyles.buyButton} />
          </div>

          <div style={section}>
            <h2 style={{ fontSize: 17, margin: 0 }}>Add a test or race</h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
              A single result, such as a 20 minute erg test, a parkrun or a race, saved to your Performance metrics.
            </p>
            <TestResultForm endpoint="/api/session/training-data" buttonClass={shopStyles.buyButton} />
          </div>

          <div style={section}>
            <h2 style={{ fontSize: 17, margin: 0 }}>Send a screenshot</h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
              If it&apos;s easier, send a picture of your PM5, watch or app screen and Dr David Silver PhD will note the numbers that matter.
            </p>
            <ScreenshotUploader buttonClass={shopStyles.buyButton} />
          </div>

          {(uploads ?? []).length > 0 && (
            <div>
              <h2 style={{ fontSize: 17, margin: "6px 0" }}>Sessions you have uploaded</h2>
              {(uploads ?? []).map((r) => (
                <div key={r.id} style={{ padding: "10px 0", borderTop: "1px solid rgba(127,127,127,0.25)", fontSize: 14 }}>
                  <div>
                    <b>{SPORT[r.sport] ?? r.sport}</b>, {day(r.rowed_on)}: {r.distance_m} m in {time(r.time_tenths)}
                    {r.workout_type ? `, ${r.workout_type}` : ""}
                  </div>
                  <RemoveUploadedSession id={r.id} />
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 18, fontSize: 14 }}>
            <Link href="/session/me">Back to Me</Link>
          </div>
        </div>
      </div>
      <ClientTabBar userId={user.id} />
    </div>
  );
}
