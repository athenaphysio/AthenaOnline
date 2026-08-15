import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { currentWeekNumber, elapsedWeeks, todayIsoWeekday, sessionDate } from "@/lib/programmeWeek";
import { computeDayStatus } from "@/lib/patientEngagement";
import { resolveWorkoutItems, computeSessionDurationSeconds } from "@/lib/workoutResolution";
import { getPostFinishSuggestion } from "@/lib/shopSections";
import { getGoalImageSignedUrl } from "@/lib/programmeGoalImage";
import SessionHeader from "./SessionHeader";
import ContinueSection, { type OpenRoutineSummary } from "./ContinueSection";
import PatientDashboard, {
  type TodayCard,
  type MissedSession,
  type WeekDaySlot,
  type ProgrammeSession,
  type ProgrammePhaseInfo,
} from "./PatientDashboard";
import QuickLinks from "./QuickLinks";
import MeetDavidButton from "./MeetDavidButton";
import SiteBanner from "./SiteBanner";
import SuggestionCard from "./SuggestionCard";
import BuyOutrightButton from "./BuyOutrightButton";
import ExploreSection from "./ExploreSection";
import SignatureFooter from "./SignatureFooter";
import styles from "./TodaySession.module.css";

type Programme = {
  id: string;
  title: string;
  block_length_weeks: number;
  start_date: string;
  delivery_mode: "scheduled" | "open";
  source: "subscription_gated" | "owned" | "clinician_assigned";
  goal_image_path: string | null;
};

type PendingForm = { sendId: string; title: string };

function PendingFormsCard({ forms }: { forms: PendingForm[] }) {
  if (forms.length === 0) return null;
  return (
    <div className={styles.messageCard}>
      {forms.map((f) => (
        <Link
          key={f.sendId}
          href={`/forms/${f.sendId}`}
          style={{
            display: "block",
            color: "var(--crimson-dark)",
            fontWeight: 500,
            fontSize: 14,
            padding: "6px 0",
            textDecoration: "none",
          }}
        >
          A form from David: {f.title} →
        </Link>
      ))}
    </div>
  );
}

export default async function SessionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/start");
  }

  const firstName = (user.user_metadata?.first_name as string | undefined) || "there";

  // Best-effort activity signal for the clinic dashboard -- the only
  // uniform one available, since session_completions only ever fires for
  // Scheduled programmes. A trusted server-side write, not gated by RLS,
  // in a context that's already proven this is the patient's own row.
  // Must be awaited, not fire-and-forget: Vercel can freeze this function's
  // execution the moment the response is sent, silently dropping any
  // in-flight promise that isn't awaited first.
  const { data: patientRow } = await supabaseAdmin
    .from("patients")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", user.id)
    .select("wearable_tracking_enabled")
    .single<{ wearable_tracking_enabled: boolean }>();

  // This is the one query that runs under the patient's own login -- RLS
  // guarantees it can only ever return their own programmes, if any. A
  // client can have more than one at once (e.g. a Scheduled rehab block
  // plus an Open maintenance routine) -- ContinueSection surfaces all of
  // them, clearly separated, never just the newest.
  const { data: programmes } = await supabase
    .from("programmes")
    .select("id, title, block_length_weeks, start_date, delivery_mode, source, goal_image_path")
    .eq("patient_id", user.id)
    .is("access_paused_at", null)
    .order("created_at", { ascending: false })
    .returns<Programme[]>();

  const all = programmes ?? [];
  const scheduledProgramme = all.find((p) => p.delivery_mode === "scheduled") ?? null;
  const openProgrammes = all.filter((p) => p.delivery_mode === "open");

  // Past this point, ownership of every programme above is already proven --
  // checking the schedule is shared clinical content (programme_workouts),
  // fetched with the trusted server-side client, same as the exercise
  // library itself has always been readable.
  type DashboardData = {
    programmeId: string;
    title: string;
    week: number;
    blockLengthWeeks: number;
    todayDayOfWeek: number;
    todayCard: TodayCard | null;
    missedSessions: MissedSession[];
    weekDays: WeekDaySlot[];
    wholeProgramme: ProgrammeSession[];
    totalSessions: number;
    completedSessions: number;
    missedCount: number;
    phases: ProgrammePhaseInfo[];
    goalImageUrl: string | null;
  };
  let dashboardData: DashboardData | null = null;

  if (scheduledProgramme) {
    const week = currentWeekNumber(scheduledProgramme.start_date, scheduledProgramme.block_length_weeks);
    const todayDayOfWeek = todayIsoWeekday();

    const [{ data: workoutRows }, { data: completionRows }, { data: phaseRows }] = await Promise.all([
      supabaseAdmin
        .from("programme_workouts")
        .select("day_of_week, workout_id, workouts(name)")
        .eq("programme_id", scheduledProgramme.id)
        .returns<{ day_of_week: number | null; workout_id: string; workouts: { name: string } | null }[]>(),
      // Runs under the patient's own login -- RLS on session_completions
      // already guarantees this can only ever be this patient's own rows.
      supabase
        .from("session_completions")
        .select("week_number, day_of_week, status")
        .eq("programme_id", scheduledProgramme.id)
        .returns<{ week_number: number; day_of_week: number; status: "completed" | "skipped" }[]>(),
      // Same RLS model, own login -- see 0056_programme_phases.sql.
      supabase
        .from("programme_phases")
        .select("name, start_week, end_week")
        .eq("programme_id", scheduledProgramme.id)
        .order("sort_order")
        .returns<{ name: string; start_week: number; end_week: number }[]>(),
    ]);

    const scheduleByDay = new Map<number, { workoutId: string; workoutName: string }>();
    for (const w of workoutRows ?? []) {
      if (w.day_of_week == null) continue;
      scheduleByDay.set(w.day_of_week, { workoutId: w.workout_id, workoutName: w.workouts?.name ?? "Session" });
    }
    const scheduledDaysOfWeek = Array.from(scheduleByDay.keys()).sort((a, b) => a - b);

    const recordByWeekDay = new Map<string, { hasCompletion: boolean; isSkipped: boolean }>();
    for (const c of completionRows ?? []) {
      const key = `${c.week_number}:${c.day_of_week}`;
      const existing = recordByWeekDay.get(key) ?? { hasCompletion: false, isSkipped: false };
      if (c.status === "completed") existing.hasCompletion = true;
      if (c.status === "skipped") existing.isSkipped = true;
      recordByWeekDay.set(key, existing);
    }
    const recordFor = (w: number, d: number) => recordByWeekDay.get(`${w}:${d}`) ?? { hasCompletion: false, isSkipped: false };

    // THIS WEEK -- Mon..Sun, always this week's own number (never reflows).
    const weekDays: WeekDaySlot[] = [1, 2, 3, 4, 5, 6, 7].map((d) => {
      const sched = scheduleByDay.get(d);
      if (!sched) return { dayOfWeek: d, scheduled: false };
      const rec = recordFor(week, d);
      const date = sessionDate(scheduledProgramme.start_date, week, d);
      const status = computeDayStatus({ date, isSkipped: rec.isSkipped, hasCompletion: rec.hasCompletion });
      return { dayOfWeek: d, scheduled: true, workoutName: sched.workoutName, status };
    });

    const missedSessions: MissedSession[] = weekDays
      .filter((d): d is Extract<WeekDaySlot, { scheduled: true }> => d.scheduled && d.status === "missed")
      .map((d) => ({ week, dayOfWeek: d.dayOfWeek, workoutName: d.workoutName }));

    // TODAY -- exercise count and (only when genuinely calculable) an
    // estimated duration, resolved once for just today's own workout.
    let todayCard: TodayCard | null = null;
    const todaySched = scheduleByDay.get(todayDayOfWeek);
    if (todaySched) {
      const resolved = await resolveWorkoutItems(todaySched.workoutId, week);
      const rec = recordFor(week, todayDayOfWeek);
      todayCard = {
        title: todaySched.workoutName,
        exerciseCount: resolved.length,
        durationSeconds: computeSessionDurationSeconds(resolved),
        alreadyDone: rec.hasCompletion,
      };
    }

    // WHOLE PROGRAMME -- every week's copy of the same repeating schedule
    // (programme_workouts has no per-week variation -- see the Vault
    // Programmes Phase 1 audit), each occurrence keeping its own real date
    // and status.
    const wholeProgramme: ProgrammeSession[] = [];
    let completedSessions = 0;
    let missedCount = 0;
    for (let w = 1; w <= scheduledProgramme.block_length_weeks; w++) {
      for (const d of scheduledDaysOfWeek) {
        const sched = scheduleByDay.get(d)!;
        const rec = recordFor(w, d);
        const date = sessionDate(scheduledProgramme.start_date, w, d);
        const status = computeDayStatus({ date, isSkipped: rec.isSkipped, hasCompletion: rec.hasCompletion });
        if (status === "done") completedSessions += 1;
        if (status === "missed") missedCount += 1;
        wholeProgramme.push({
          week: w,
          dayOfWeek: d,
          workoutName: sched.workoutName,
          status,
          dateLabel: date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        });
      }
    }

    dashboardData = {
      programmeId: scheduledProgramme.id,
      title: scheduledProgramme.title,
      week,
      blockLengthWeeks: scheduledProgramme.block_length_weeks,
      todayDayOfWeek,
      todayCard,
      missedSessions,
      weekDays,
      wholeProgramme,
      totalSessions: wholeProgramme.length,
      completedSessions,
      missedCount,
      phases: (phaseRows ?? []).map((p) => ({
        name: p.name,
        startWeek: p.start_week,
        endWeek: p.end_week,
        status: week > p.end_week ? ("done" as const) : week >= p.start_week ? ("current" as const) : ("upcoming" as const),
      })),
      goalImageUrl: scheduledProgramme.goal_image_path
        ? await getGoalImageSignedUrl(scheduledProgramme.goal_image_path)
        : null,
    };
  }
  const openRoutines: OpenRoutineSummary[] = openProgrammes.map((p) => ({ id: p.id, title: p.title }));

  // "Finished" means the same thing here as the clinic dashboard's own
  // "block_ended" status (src/lib/patientStatus.ts): the block's nominal
  // weeks have fully elapsed, not merely "no workout today." Open routines
  // have no such end, so this only ever applies to the Scheduled programme.
  // One calm suggestion at most, chosen by the platform, never shown above
  // ContinueSection.
  const hasFinishedProgramme =
    scheduledProgramme != null &&
    elapsedWeeks(scheduledProgramme.start_date) >= scheduledProgramme.block_length_weeks;
  const suggestion = hasFinishedProgramme ? getPostFinishSuggestion() : undefined;

  // Forms may be sent before any programme exists (e.g. an intake form),
  // so this is checked regardless of what's above. Runs under the patient's
  // own login, same trust boundary as everything else on this page -- RLS
  // (0022_forms.sql) guarantees these are only ever this patient's own
  // sends/responses. Titles are fetched separately via supabaseAdmin once
  // ownership is proven -- forms/form_questions have no authenticated-read
  // RLS policy (Owner-only), so an embedded join through the patient's own
  // client would silently come back null.
  type PendingSendRow = { id: string; form_id: string };
  const [{ data: sends }, { data: responses }] = await Promise.all([
    supabase
      .from("form_sends")
      .select("id, form_id")
      .eq("patient_id", user.id)
      .order("sent_at", { ascending: false })
      .returns<PendingSendRow[]>(),
    supabase.from("form_responses").select("form_send_id").eq("patient_id", user.id).returns<{ form_send_id: string }[]>(),
  ]);
  const respondedSendIds = new Set((responses ?? []).map((r) => r.form_send_id));
  const seenFormIds = new Set<string>();
  const pendingSends: PendingSendRow[] = [];
  for (const s of sends ?? []) {
    if (respondedSendIds.has(s.id) || seenFormIds.has(s.form_id)) continue;
    seenFormIds.add(s.form_id);
    pendingSends.push(s);
  }
  let pendingForms: PendingForm[] = [];
  if (pendingSends.length > 0) {
    const { data: pendingFormRows } = await supabaseAdmin
      .from("forms")
      .select("id, title")
      .in(
        "id",
        pendingSends.map((s) => s.form_id)
      )
      .returns<{ id: string; title: string }[]>();
    const titleByFormId = new Map((pendingFormRows ?? []).map((f) => [f.id, f.title]));
    pendingForms = pendingSends
      .filter((s) => titleByFormId.has(s.form_id))
      .map((s) => ({ sendId: s.id, title: titleByFormId.get(s.form_id)! }));
  }

  return (
    <div className={styles.app}>
      <SiteBanner />
      <div className={styles.inner}>
        <SessionHeader firstName={firstName} />

        {dashboardData ? (
          <>
            <div className={styles.zone}>
              <PatientDashboard {...dashboardData} />
            </div>
            {openRoutines.length > 0 && (
              <div className={styles.zone}>
                <div className={styles.secondaryList}>
                  {openRoutines.map((routine) => (
                    <Link key={routine.id} href={`/session/${routine.id}`} className={styles.secondaryRow}>
                      <span className={styles.secondaryRowTitle}>{routine.title}</span>
                      <span className={styles.secondaryRowLink}>Continue →</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className={styles.zone}>
            <ContinueSection scheduled={null} openRoutines={openRoutines} />
          </div>
        )}

        <div className={styles.zone}>
          <QuickLinks />
        </div>

        {pendingForms.length > 0 && (
          <div className={styles.zone}>
            <PendingFormsCard forms={pendingForms} />
          </div>
        )}

        {hasFinishedProgramme && scheduledProgramme && scheduledProgramme.source !== "owned" && (
          <div className={styles.zone}>
            <BuyOutrightButton programmeId={scheduledProgramme.id} label="Keep this programme, one-off payment" />
          </div>
        )}

        {suggestion && (
          <div className={styles.zone}>
            <SuggestionCard section={suggestion} />
          </div>
        )}

        <div className={styles.zone} id="explore">
          <ExploreSection />
        </div>

        <div className={styles.zone}>
          <SignatureFooter />
        </div>

        <div className={styles.zone}>
          <MeetDavidButton />
        </div>
      </div>
    </div>
  );
}
