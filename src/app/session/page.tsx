import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { currentWeekNumber, elapsedWeeks, todayIsoWeekday } from "@/lib/programmeWeek";
import { getPostFinishSuggestion } from "@/lib/shopSections";
import SessionHeader from "./SessionHeader";
import ContinueSection, { type ScheduledStatus, type OpenRoutineSummary } from "./ContinueSection";
import SuggestionCard from "./SuggestionCard";
import BuyOutrightButton from "./BuyOutrightButton";
import ExploreSection from "./ExploreSection";
import styles from "./TodaySession.module.css";

type Programme = {
  id: string;
  title: string;
  block_length_weeks: number;
  start_date: string;
  delivery_mode: "scheduled" | "open";
  source: "subscription_gated" | "owned" | "clinician_assigned";
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
    .select("id, title, block_length_weeks, start_date, delivery_mode, source")
    .eq("patient_id", user.id)
    .is("access_paused_at", null)
    .order("created_at", { ascending: false })
    .returns<Programme[]>();

  const all = programmes ?? [];
  const scheduledProgramme = all.find((p) => p.delivery_mode === "scheduled") ?? null;
  const openProgrammes = all.filter((p) => p.delivery_mode === "open");

  // Past this point, ownership of every programme above is already proven --
  // checking today's schedule is shared clinical content (programme_workouts),
  // fetched with the trusted server-side client, same as the exercise
  // library itself has always been readable.
  let scheduled: ScheduledStatus | null = null;
  if (scheduledProgramme) {
    const week = currentWeekNumber(scheduledProgramme.start_date, scheduledProgramme.block_length_weeks);
    const today = todayIsoWeekday();
    const { data: assignment } = await supabaseAdmin
      .from("programme_workouts")
      .select("workout_id")
      .eq("programme_id", scheduledProgramme.id)
      .eq("day_of_week", today)
      .maybeSingle<{ workout_id: string }>();
    scheduled = {
      id: scheduledProgramme.id,
      title: scheduledProgramme.title,
      week,
      blockLengthWeeks: scheduledProgramme.block_length_weeks,
      hasWorkoutToday: Boolean(assignment),
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
      <div className={styles.inner}>
        <SessionHeader firstName={firstName} />

        <div className={styles.zone}>
          <ContinueSection scheduled={scheduled} openRoutines={openRoutines} />
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

        <div className={styles.zone}>
          <ExploreSection />
        </div>
      </div>
    </div>
  );
}
