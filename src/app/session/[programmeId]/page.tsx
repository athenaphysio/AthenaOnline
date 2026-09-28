import type { ReactNode } from "react";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { currentWeekNumber, todayIsoWeekday, sessionDate } from "@/lib/programmeWeek";
import { resolveWorkoutItems, toSessionItems } from "@/lib/workoutResolution";
import { isProgrammeClosed } from "@/lib/programmeAccessWindow";
import { resolveBrandPack } from "@/lib/brandPackResolve";
import { resolveExpiredFlares, workoutOverrideFor } from "@/lib/runningFlareUp";
import TodaySession from "../TodaySession";
import RestDayScreen from "../RestDayScreen";
import OpenRoutine from "../OpenRoutine";
import MorningCheckinPrompt from "../MorningCheckinPrompt";

type Programme = {
  id: string;
  title: string;
  audio_url: string | null;
  block_length_weeks: number;
  access_window_weeks: number | null;
  start_date: string;
  delivery_mode: "scheduled" | "open";
};

// Reached by tapping Continue on the landing page (/session) -- one
// programme's actual session or routine, not a triage screen. Every
// client-facing route down here still runs its own ownership check; the
// landing page having already listed this programme is not a substitute.
const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default async function ProgrammeSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ programmeId: string }>;
  searchParams: Promise<{ purchase?: string; week?: string; day?: string }>;
}) {
  const { programmeId } = await params;
  const { purchase, week: weekParam, day: dayParam } = await searchParams;

  // Optional: catching up on a specific missed session from earlier in the
  // week, rather than today's own -- see the dashboard's "Do it now"
  // action. Falls back to today whenever either is missing or malformed.
  const parsedWeek = weekParam ? parseInt(weekParam, 10) : NaN;
  const parsedDay = dayParam ? parseInt(dayParam, 10) : NaN;
  const targetOverride =
    Number.isInteger(parsedWeek) && parsedWeek >= 1 && Number.isInteger(parsedDay) && parsedDay >= 1 && parsedDay <= 7
      ? { week: parsedWeek, day: parsedDay }
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/start");
  }

  const firstName = (user.user_metadata?.first_name as string | undefined) || "there";

  // The buy-outright success_url/cancel_url both point back here -- same
  // banner pattern as the shop and membership pages, just threaded through
  // SessionHeader since this route has no page-level wrapper of its own.
  const banner =
    purchase === "success" ? (
      <div
        style={{
          background: "var(--crimson-light)",
          border: "1px solid var(--crimson)",
          borderRadius: 14,
          padding: "14px 18px",
          margin: "0 22px 16px",
          color: "var(--crimson-dark)",
          fontSize: 14,
        }}
      >
        Payment received, thank you. This programme is yours to keep.
      </div>
    ) : purchase === "cancelled" ? (
      <div
        style={{
          background: "var(--sand)",
          borderRadius: 14,
          padding: "14px 18px",
          margin: "0 22px 16px",
          color: "var(--stone)",
          fontSize: 14,
        }}
      >
        Checkout was cancelled, nothing was charged.
      </div>
    ) : undefined;

  // The next-morning question (Step 4 of the Running Builder brief) --
  // shown once, only when the most recent Run block this client completed
  // was on an earlier calendar day and hasn't been answered yet. Never
  // shown alongside the purchase banner above; that one-off redirect
  // banner always wins the single banner slot.
  let morningCheckinBanner: ReactNode | undefined;
  if (!banner) {
    const { data: lastRun } = await supabase
      .from("session_completions")
      .select("id, occurred_at")
      .eq("patient_id", user.id)
      .eq("status", "completed")
      .not("run_stable_id", "is", null)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; occurred_at: string }>();

    if (lastRun) {
      const occurredDate = new Date(lastRun.occurred_at);
      const today = new Date();
      const isEarlierDay = occurredDate.toDateString() !== today.toDateString() && occurredDate < today;
      if (isEarlierDay) {
        const { data: existingCheckin } = await supabase
          .from("run_morning_checkins")
          .select("id")
          .eq("session_completion_id", lastRun.id)
          .maybeSingle();
        if (!existingCheckin) {
          morningCheckinBanner = <MorningCheckinPrompt sessionCompletionId={lastRun.id} />;
        }
      }
    }
  }
  const effectiveBanner = banner ?? morningCheckinBanner;

  // Runs under the patient's own login -- RLS guarantees this only ever
  // resolves if the programme genuinely belongs to them. Anyone else's id
  // simply returns null here, same as /forms/[sendId] -- not a leak, a
  // straightforward 404.
  const { data: programme } = await supabase
    .from("programmes")
    .select("id, title, audio_url, block_length_weeks, access_window_weeks, start_date, delivery_mode")
    .eq("id", programmeId)
    .eq("patient_id", user.id)
    .is("access_paused_at", null)
    .maybeSingle<Programme>();

  if (!programme) {
    notFound();
  }

  const brand = await resolveBrandPack({ patientId: user.id, programmeId: programme.id });

  // Step 5's own lazy check, same reasoning as evaluateRunProgression --
  // whoever next opens the app is what actually resolves an expired
  // flare's rung drop-back, no cron involved. Harmless no-op for a
  // programme that was never a running one.
  await resolveExpiredFlares(programme.id);

  // Direct-URL access is exactly what this exists to catch -- reaching a
  // closed programme via a bookmarked link or the "This week" list's own
  // (disabled) links must land on the same locked experience the
  // dashboard already shows, not the real exercise content. See the
  // Phase 4 access-window brief.
  if (
    await isProgrammeClosed(user.id, { startDate: programme.start_date, accessWindowWeeks: programme.access_window_weeks })
  ) {
    redirect("/session");
  }

  // Past this point, ownership is already proven -- resolving the workout's
  // actual content is shared clinical data (blocks/workouts/exercises),
  // fetched with the trusted server-side client, same as the exercise
  // library itself has always been readable.
  if (programme.delivery_mode === "open") {
    const { data: assignment } = await supabaseAdmin
      .from("programme_workouts")
      .select("workout_id")
      .eq("programme_id", programme.id)
      .maybeSingle<{ workout_id: string }>();
    const items = assignment ? await toSessionItems(await resolveWorkoutItems(assignment.workout_id, 1)) : [];

    return (
      <OpenRoutine
        programmeId={programme.id}
        patientFirstName={firstName}
        programme={{ title: programme.title, audio_url: programme.audio_url, items }}
        banner={effectiveBanner}
        brand={brand}
      />
    );
  }

  const currentWeek = currentWeekNumber(programme.start_date, programme.block_length_weeks);
  const today = todayIsoWeekday();
  const week = targetOverride?.week ?? currentWeek;
  const dayOfWeek = targetOverride?.day ?? today;
  const isCatchUp = targetOverride != null && targetOverride.day !== today;

  // A flare-up override for this exact calendar date always wins, even
  // over what would otherwise have been a rest day -- "keep active with
  // non-impact work" is the whole point of the deload plan, see
  // runningFlareUp.ts.
  const overrideWorkoutId = await workoutOverrideFor(programme.id, sessionDate(programme.start_date, week, dayOfWeek));

  const { data: assignment } = overrideWorkoutId
    ? { data: { workout_id: overrideWorkoutId } }
    : await supabaseAdmin
        .from("programme_workouts")
        .select("workout_id")
        .eq("programme_id", programme.id)
        .eq("day_of_week", dayOfWeek)
        .maybeSingle<{ workout_id: string }>();

  if (!assignment) {
    return <RestDayScreen firstName={firstName} banner={effectiveBanner} brand={brand} />;
  }

  const { data: runningState } = await supabaseAdmin
    .from("running_programme_state")
    .select("id")
    .eq("programme_id", programme.id)
    .maybeSingle<{ id: string }>();
  const { data: activeFlare } = runningState
    ? await supabaseAdmin
        .from("running_flare_events")
        .select("id")
        .eq("programme_id", programme.id)
        .eq("status", "active")
        .maybeSingle<{ id: string }>()
    : { data: null };
  const showFlareButton = Boolean(runningState) && !activeFlare;

  // Runs under the patient's own login, same as the programme lookup above
  // -- RLS on session_completions already guarantees this can only ever be
  // this patient's own rows.
  const { data: completions } = await supabase
    .from("session_completions")
    .select("exercise_id, cardio_block_id, run_stable_id")
    .eq("programme_id", programme.id)
    .eq("week_number", week)
    .eq("day_of_week", dayOfWeek)
    .eq("status", "completed")
    .returns<{ exercise_id: string | null; cardio_block_id: string | null; run_stable_id: string | null }[]>();
  const initialDoneIds = (completions ?? []).map((c) => c.exercise_id ?? c.cardio_block_id ?? c.run_stable_id!);

  const sessionItems = await toSessionItems(await resolveWorkoutItems(assignment.workout_id, week));

  return (
    <TodaySession
      programmeId={programme.id}
      firstName={firstName}
      programme={{
        title: programme.title,
        audio_url: programme.audio_url,
        programme_items: sessionItems,
      }}
      initialDoneIds={initialDoneIds}
      banner={effectiveBanner}
      targetWeek={week}
      targetDay={dayOfWeek}
      eyebrow={isCatchUp ? `Catching up: ${DAY_LABELS[dayOfWeek - 1]}` : "Today's session"}
      brand={brand}
      showFlareButton={showFlareButton}
    />
  );
}
