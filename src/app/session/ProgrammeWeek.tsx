import { weekdayName } from "@/i18n/format";
import type { Lang } from "@/i18n/languages";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { currentWeekNumber } from "@/lib/programmeWeek";
import { loadAnyDaySessions, loadWeekSessions } from "@/lib/programmeCards";
import { isRestDay } from "@/lib/planToBuilder";
import PlanMorningCheckinPrompt from "../plan/PlanMorningCheckinPrompt";
import ProgrammeWeekView, { type WeekDay } from "./ProgrammeWeekView";
import { loadRowingContext } from "@/lib/rowing/rowingServer";
import { goalPathFor } from "@/lib/rowing/onTarget";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getVimeoInfo } from "@/lib/vimeo";
import type { CardCircuit } from "@/lib/runCircuit";
import type { ClientCircuit, ClientCircuitExercise } from "./RunCircuitSession";

type ExerciseMedia = {
  exercise_id: string;
  name_clinical: string | null;
  name_patient_facing: string | null;
  primary_aim: string | null;
  vimeo_url: string | null;
  illustration_url: string | null;
};

// A Run Circuit card carries this client's own copy of each block's
// exercises. Names, videos and the reason each exercise is there are read
// fresh from the exercise library, so a newly filmed video shows up
// without the programme being rebuilt.
async function withExerciseMedia(circuits: CardCircuit[]): Promise<Map<CardCircuit, ClientCircuit>> {
  const ids = Array.from(new Set(circuits.flatMap((c) => c.blocks.flatMap((b) => b.exercises.map((e) => e.exercise_id)))));
  const media = new Map<string, ExerciseMedia>();
  if (ids.length > 0) {
    const { data } = await supabaseAdmin
      .from("exercises")
      .select("exercise_id, name_clinical, name_patient_facing, primary_aim, vimeo_url, illustration_url")
      .in("exercise_id", ids)
      .returns<ExerciseMedia[]>();
    for (const m of data ?? []) media.set(m.exercise_id, m);
  }
  const videos = new Map<string, Awaited<ReturnType<typeof getVimeoInfo>>>();
  await Promise.all(
    Array.from(media.values()).map(async (m) => {
      videos.set(m.exercise_id, await getVimeoInfo(m.vimeo_url));
    })
  );
  const out = new Map<CardCircuit, ClientCircuit>();
  for (const c of circuits) {
    out.set(c, {
      ...c,
      blocks: c.blocks.map((b) => ({
        ...b,
        exercises: b.exercises.map((e): ClientCircuitExercise => {
          const m = media.get(e.exercise_id);
          const v = videos.get(e.exercise_id) ?? null;
          return {
            ...e,
            name: m?.name_patient_facing || m?.name_clinical || e.name,
            why: m?.primary_aim ?? "",
            video: v ? { embedUrl: v.embedUrl, aspectRatio: v.aspectRatio } : null,
            illustration: m?.illustration_url ?? null,
          };
        }),
      })),
    });
  }
  return out;
}

type ProgrammeRow = {
  id: string;
  title: string;
  intro: string | null;
  plan_rules: { move_on: string; flare: string } | null;
  week_labels: Record<string, string> | null;
  rest_days: number[] | null;
  start_date: string;
  block_length_weeks: number;
};

const DAY_NUMBERS = [1, 2, 3, 4, 5, 6, 7];

// The client's weekly view for a programme whose sessions are tied to
// weeks: cardio cards and strength sessions together, logging for both.
// Runs under the client's own login for everything they own; the shared
// session content itself is read with the trusted client, as elsewhere.
export default async function ProgrammeWeek({
  programmeId,
  userId,
  weekParam,
  db,
  lang = "en",
}: {
  /** The client's language, for the day names. */
  lang?: Lang;
  programmeId: string;
  userId: string;
  weekParam?: string;
  /** The clinic's Client view passes its own client; the app uses the client's login. */
  db?: SupabaseClient;
}) {
  const supabase = db ?? (await createClient());
  const { data: programme } = await supabase
    .from("programmes")
    .select("id, title, intro, plan_rules, week_labels, rest_days, start_date, block_length_weeks")
    .eq("id", programmeId)
    .eq("patient_id", userId)
    .maybeSingle<ProgrammeRow>();
  if (!programme) return null;

  const parsed = weekParam ? parseInt(weekParam, 10) : NaN;
  const todayWeek = currentWeekNumber(programme.start_date, programme.block_length_weeks);
  const week = Number.isInteger(parsed) && parsed >= 1 && parsed <= programme.block_length_weeks ? parsed : todayWeek;

  const [sessions, anyDaySessions, { data: logRows }, { data: completions }] = await Promise.all([
    loadWeekSessions(programme.id, week),
    loadAnyDaySessions(programme.id, week),
    supabase
      .from("programme_card_logs")
      .select("id, workout_id, week_number, completed_quality, completed_at, next_morning_answer, run_circuit")
      .eq("programme_id", programme.id)
      .returns<
        {
          id: string;
          workout_id: string;
          week_number: number;
          completed_quality: string | null;
          completed_at: string;
          next_morning_answer: string | null;
          run_circuit: unknown;
        }[]
      >(),
    supabase
      .from("session_completions")
      .select("week_number, day_of_week, workout_id")
      .eq("programme_id", programme.id)
      .eq("status", "completed")
      .returns<{ week_number: number; day_of_week: number; workout_id: string | null }[]>(),
  ]);
  const logs = logRows ?? [];
  const doneDays = new Set((completions ?? []).filter((c) => c.week_number === week && !c.workout_id).map((c) => c.day_of_week));
  const doneAnyDay = new Set((completions ?? []).filter((c) => c.week_number === week && c.workout_id).map((c) => c.workout_id as string));
  const anyDay = anyDaySessions.map((s) => ({
    kind: "workout" as const,
    workoutId: s.workoutId,
    title: s.name,
    href: `/session/${programme.id}?week=${week}&workout=${s.workoutId}&any=1`,
    done: doneAnyDay.has(s.workoutId),
    empty: false,
  }));
  const loggedThisWeek = new Set(logs.filter((l) => l.week_number === week && l.completed_quality).map((l) => l.workout_id));

  const circuitMedia = await withExerciseMedia(sessions.map((s) => s.plan?.circuit).filter((c): c is CardCircuit => Boolean(c)));

  const restDays = programme.rest_days ?? [];
  const days: WeekDay[] = DAY_NUMBERS.map((dayNumber, i) => {
    const label = weekdayName(dayNumber, lang);
    const day = i + 1;
    const here = sessions.filter((s) => s.day === day);
    return {
      day,
      label,
      rest: isRestDay(restDays, week, day),
      sessions: here.map((s) => {
        if (s.plan && s.plan.type !== "strength") {
          return {
            kind: "card" as const,
            workoutId: s.workoutId,
            title: s.plan.title || s.name,
            type: s.plan.type,
            summary: s.plan.summary,
            steps: s.plan.steps,
            target: s.plan.target,
            total: s.plan.total,
            notes: s.plan.notes,
            done: loggedThisWeek.has(s.workoutId),
            circuit: s.plan.circuit ? circuitMedia.get(s.plan.circuit) ?? null : null,
          };
        }
        return {
          kind: "workout" as const,
          workoutId: s.workoutId,
          title: s.plan ? s.plan.title || s.name : s.name,
          href: `/session/${programme.id}?week=${week}&day=${day}&workout=${s.workoutId}`,
          done: doneDays.has(day),
          empty: Boolean(s.plan),
        };
      }),
    };
  });

  // The next-morning question: the most recent logged cardio card from an
  // earlier calendar day that has no answer yet. A Run Circuit is never
  // asked about the next morning: its own log covers it.
  const today = new Date();
  const pending = logs
    .filter((l) => l.completed_quality && !l.next_morning_answer && !l.run_circuit)
    .filter((l) => {
      const d = new Date(l.completed_at);
      return d.toDateString() !== today.toDateString() && d < today;
    })
    .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())[0];

  const labels = programme.week_labels ?? {};

  // A Rowing and Running Builder plan shows the client their own path to
  // their goal: their tests against the line from where they started.
  // Only their own numbers; the clinic's on target reading stays with
  // Dr David Silver PhD. Never allowed to break the week view.
  let goalPath = null;
  try {
    const rowingCtx = await loadRowingContext(programme.id);
    if (rowingCtx && rowingCtx.programme.patient_id === userId) goalPath = goalPathFor(rowingCtx);
  } catch {
    goalPath = null;
  }

  return (
    <>
      {pending && <PlanMorningCheckinPrompt logId={pending.id} endpoint="/api/session/card-morning-checkin" />}
      <ProgrammeWeekView
        programmeId={programme.id}
        title={programme.title}
        intro={programme.intro ?? ""}
        weekNumber={week}
        totalWeeks={programme.block_length_weeks}
        weekLabel={labels[String(week)] ?? ""}
        prevHref={week > 1 ? `/session/${programme.id}?week=${week - 1}` : null}
        nextHref={week < programme.block_length_weeks ? `/session/${programme.id}?week=${week + 1}` : null}
        showIntro={week === 1}
        rules={programme.plan_rules}
        days={days}
        anyDay={anyDay}
        goalPath={goalPath}
      />
    </>
  );
}
