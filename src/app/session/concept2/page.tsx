import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { concept2Configured } from "@/lib/rowing/concept2";
import { formatDuration, formatSplit } from "@/lib/rowing/zones";
import sessionStyles from "../TodaySession.module.css";
import shopStyles from "../../shop/shop.module.css";
import DisconnectConcept2Button from "./DisconnectConcept2Button";
import ClientTabBar from "../ClientTabBar";

const ERRORS: Record<string, string> = {
  not_ready: "The Concept2 link isn't switched on just yet. Dr David Silver PhD can still read your rows from photos of the PM5 screen in the meantime.",
  declined: "The link wasn't completed on the Concept2 page, so nothing has changed. You can try again whenever you like.",
  expired: "That took a little long and the link timed out. Tap connect again and it should go straight through.",
  exchange: "Concept2 didn't confirm the link. Try again, and if it happens twice, tell Dr David Silver PhD.",
  start: "The link couldn't be started. Try again in a moment.",
};

type SearchParams = Promise<{ connected?: string; error?: string }>;

// Where a client links their Concept2 Logbook, so every row on the PM5
// reaches their rowing plan without them typing anything in.
export default async function Concept2Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/start");

  const { data: conn } = await supabaseAdmin
    .from("concept2_connections")
    .select("connected_at, last_synced_at")
    .eq("patient_id", user.id)
    .maybeSingle<{ connected_at: string; last_synced_at: string | null }>();

  const { data: rows } = await supabase
    .from("rowing_results")
    .select("id, rowed_on, distance_m, time_tenths, avg_split_seconds")
    .eq("patient_id", user.id)
    .order("rowed_on", { ascending: false })
    .limit(10)
    .returns<{ id: string; rowed_on: string; distance_m: number; time_tenths: number; avg_split_seconds: number }[]>();

  const message = params.connected ? "Connected. Your rows will reach your plan from now on." : params.error ? ERRORS[params.error] ?? ERRORS.start : null;

  return (
    <div className={sessionStyles.app}>
      <div className={sessionStyles.inner}>
        <div className={sessionStyles.head}>
          <h1>Your rowing data</h1>
          <p>
            Link your Concept2 Logbook and every row you do on the PM5 reaches your plan by itself, so Dr David Silver PhD can see how
            each practice actually went and adjust your paces from real numbers rather than guesses.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "0 22px 32px" }}>
          {message && <p style={{ margin: 0, lineHeight: 1.5 }}>{message}</p>}

          {conn ? (
            <>
              <p style={{ margin: 0, lineHeight: 1.5 }}>
                Your Concept2 Logbook is connected. Row with the ErgData app on your phone linked to the PM5, and each row is saved to your
                Logbook and picked up from there.
              </p>
              <DisconnectConcept2Button />
            </>
          ) : concept2Configured() ? (
            <>
              <p style={{ margin: 0, lineHeight: 1.5 }}>
                You will sign in on Concept2&apos;s own page, so your password stays with them. If you don&apos;t have a Logbook yet, you can make one
                there for free. This app only reads your rowing results; it never changes them.
              </p>
              <a href="/api/session/concept2/connect" className={shopStyles.buyButton} style={{ textAlign: "center", textDecoration: "none" }}>
                Connect Concept2
              </a>
            </>
          ) : (
            <p style={{ margin: 0, lineHeight: 1.5 }}>{ERRORS.not_ready}</p>
          )}

          {(rows ?? []).length > 0 && (
            <div>
              <h2 style={{ fontSize: 17, margin: "10px 0 6px" }}>Your recent rows</h2>
              {(rows ?? []).map((r) => (
                <div key={r.id} style={{ fontSize: 14, padding: "8px 0", borderTop: "1px solid rgba(127,127,127,0.25)" }}>
                  {new Date(`${r.rowed_on}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}:{" "}
                  {r.distance_m.toLocaleString("en-GB")}m in {formatDuration(r.time_tenths / 10)}, {formatSplit(Number(r.avg_split_seconds))} per 500m
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
