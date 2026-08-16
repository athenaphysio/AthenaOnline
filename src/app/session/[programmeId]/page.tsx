import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { currentWeekNumber, todayIsoWeekday } from "@/lib/programmeWeek";
import { resolveWorkoutItems, toSessionItems } from "@/lib/workoutResolution";
import { isProgrammeClosed } from "@/lib/programmeAccessWindow";
import TodaySession from "../TodaySession";
import RestDayScreen from "../RestDayScreen";
import OpenRoutine from "../OpenRoutine";

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
        banner={banner}
      />
    );
  }

  const currentWeek = currentWeekNumber(programme.start_date, programme.block_length_weeks);
  const today = todayIsoWeekday();
  const week = targetOverride?.week ?? currentWeek;
  const dayOfWeek = targetOverride?.day ?? today;
  const isCatchUp = targetOverride != null && targetOverride.day !== today;

  const { data: assignment } = await supabaseAdmin
    .from("programme_workouts")
    .select("workout_id")
    .eq("programme_id", programme.id)
    .eq("day_of_week", dayOfWeek)
    .maybeSingle<{ workout_id: string }>();

  if (!assignment) {
    return <RestDayScreen firstName={firstName} banner={banner} />;
  }

  // Runs under the patient's own login, same as the programme lookup above
  // -- RLS on session_completions already guarantees this can only ever be
  // this patient's own rows.
  const { data: completions } = await supabase
    .from("session_completions")
    .select("exercise_id, cardio_block_id")
    .eq("programme_id", programme.id)
    .eq("week_number", week)
    .eq("day_of_week", dayOfWeek)
    .eq("status", "completed")
    .returns<{ exercise_id: string | null; cardio_block_id: string | null }[]>();
  const initialDoneIds = (completions ?? []).map((c) => c.exercise_id ?? c.cardio_block_id!);

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
      banner={banner}
      targetWeek={week}
      targetDay={dayOfWeek}
      eyebrow={isCatchUp ? `Catching up: ${DAY_LABELS[dayOfWeek - 1]}` : "Today's session"}
    />
  );
}
