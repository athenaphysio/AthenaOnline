import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { activeLinks, loadPlanner, plannerEnabled } from "@/lib/diaryServer";
import { googleCalendarConfigured } from "@/lib/googleCalendar";
import { APP_URL } from "@/lib/appUrl";
import DiaryPlanner from "@/components/diary/DiaryPlanner";
import PlannerLinks from "./PlannerLinks";
import DisconnectGoogleButton from "./DisconnectGoogleButton";
import sessionStyles from "../TodaySession.module.css";
import shopStyles from "../../shop/shop.module.css";
import ClientTabBar from "../ClientTabBar";

const ERRORS: Record<string, string> = {
  not_ready: "The Google Calendar link isn't switched on just yet. You can still plan your sessions here in the meantime.",
  declined: "The link wasn't completed on the Google page, so nothing has changed. You can try again whenever you like.",
  expired: "That took a little long and the link timed out. Tap connect again and it should go straight through.",
  exchange: "Google didn't confirm the link. Try again, and if it happens twice, tell Dr David Silver PhD.",
  start: "The link couldn't be started. Try again in a moment.",
};

type SearchParams = Promise<{ connected?: string; error?: string }>;

// Where a client fits their practice around their diary: placing sessions
// themselves, linking Google Calendar, and sharing the planner with a PA.
export default async function DiaryPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/start");
  if (!(await plannerEnabled(user.id))) redirect("/session/me");

  const [data, links] = await Promise.all([loadPlanner(user.id, "client"), activeLinks(user.id)]);
  const message = params.connected
    ? "Connected. Your Athena Training calendar is now in Google Calendar."
    : params.error
      ? (ERRORS[params.error] ?? ERRORS.start)
      : null;

  return (
    <div className={sessionStyles.app}>
      <div className={sessionStyles.inner}>
        <div className={sessionStyles.head}>
          <h1>Your diary</h1>
          <p>
            Fit your practice around the week you actually have. Give each session a day, a time, how long you have and where you will
            be, and the session adjusts to the time available.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22, padding: "0 22px 32px" }}>
          {message && <p style={{ margin: 0, lineHeight: 1.5 }}>{message}</p>}

          <section>
            <h2 style={{ fontSize: 17, margin: "6px 0 6px" }}>Google Calendar</h2>
            {data.google.connected ? (
              <>
                <p style={{ margin: "0 0 10px", lineHeight: 1.5 }}>
                  Linked{data.google.email ? ` as ${data.google.email}` : ""}. Your sessions appear in a calendar called Athena Training,
                  alongside your work diary. The app can only see and change that one calendar, never the rest of your diary. To let your
                  PA see it in their own Google Calendar, share Athena Training with them from Google Calendar&apos;s settings.
                </p>
                <DisconnectGoogleButton />
              </>
            ) : googleCalendarConfigured() ? (
              <>
                <p style={{ margin: "0 0 10px", lineHeight: 1.5 }}>
                  You will sign in on Google&apos;s own page, so your password stays with them. The app makes one new calendar, Athena
                  Training, and can only see and change that one. Nothing else in your diary is read.
                </p>
                <a href="/api/session/google-calendar/connect" className={shopStyles.buyButton} style={{ textAlign: "center", textDecoration: "none" }}>
                  Link Google Calendar
                </a>
              </>
            ) : (
              <p style={{ margin: 0, lineHeight: 1.5 }}>{ERRORS.not_ready}</p>
            )}
          </section>

          <section>
            <h2 style={{ fontSize: 17, margin: "6px 0 6px" }}>Share with your PA</h2>
            <p style={{ margin: "0 0 4px", lineHeight: 1.5 }}>
              If someone manages your diary, make them a planner link. They can place and move your sessions without logging in, and
              they see only the slots, never your programme, notes or messages. You can switch a link off at any time.
            </p>
            <PlannerLinks initial={links.map((l) => ({ id: l.id, paName: l.paName, url: `${APP_URL}/planner/${l.token}`, lastUsedAt: l.lastUsedAt }))} />
          </section>

          <section>
            <h2 style={{ fontSize: 17, margin: "6px 0 10px" }}>This week and next</h2>
            <DiaryPlanner initial={data} endpoint="/api/session/diary" />
          </section>

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
