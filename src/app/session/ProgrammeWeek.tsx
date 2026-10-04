import { createClient } from "@/lib/supabase/server";
import { currentWeekNumber } from "@/lib/programmeWeek";
import { loadWeekSessions } from "@/lib/programmeCards";
import { isRestDay } from "@/lib/planToBuilder";
import PlanMorningCheckinPrompt from "../plan/PlanMorningCheckinPrompt";
import ProgrammeWeekView, { type WeekDay } from "./ProgrammeWeekView";

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

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// The client's weekly view for a programme whose sessions are tied to
// weeks: cardio cards and strength sessions together, logging for both.
// Runs under the client's own login for everything they own; the shared
// session content itself is read with the trusted client, as elsewhere.
export default async function ProgrammeWeek({
  programmeId,
  userId,
  weekParam,
}: {
  programmeId: string;
  userId: string;
  weekParam?: string;
}) {
  const supabase = await createClient();
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

  const [sessions, { data: logRows }, { data: completions }] = await Promise.all([
    loadWeekSessions(programme.id, week),
    supabase
      .from("programme_card_logs")
      .select("id, workout_id, week_number, completed_quality, completed_at, next_morning_answer")
      .eq("programme_id", programme.id)
      .returns<
        { id: string; workout_id: string; week_number: number; completed_quality: string | null; completed_at: string; next_morning_answer: string | null }[]
      >(),
    supabase
      .from("session_completions")
      .select("week_number, day_of_week")
      .eq("programme_id", programme.id)
      .eq("status", "completed")
      .returns<{ week_number: number; day_of_week: number }[]>(),
  ]);
  const logs = logRows ?? [];
  const doneDays = new Set((completions ?? []).filter((c) => c.week_number === week).map((c) => c.day_of_week));
  const loggedThisWeek = new Set(logs.filter((l) => l.week_number === week && l.completed_quality).map((l) => l.workout_id));

  const restDays = programme.rest_days ?? [];
  const days: WeekDay[] = DAY_NAMES.map((label, i) => {
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
  // earlier calendar day that has no answer yet.
  const today = new Date();
  const pending = logs
    .filter((l) => l.completed_quality && !l.next_morning_answer)
    .filter((l) => {
      const d = new Date(l.completed_at);
      return d.toDateString() !== today.toDateString() && d < today;
    })
    .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())[0];

  const labels = programme.week_labels ?? {};

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
      />
    </>
  );
}
