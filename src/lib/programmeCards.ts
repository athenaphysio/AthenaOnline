import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PlanCardData } from "@/lib/planToBuilder";

// What one programme week looks like once plan-code cards and library
// sessions sit in the same calendar.
export type WeekSession = {
  workoutId: string;
  name: string;
  day: number;
  sortOrder: number;
  /** Set for a card that came from plan code. */
  plan: PlanCardData | null;
};

type Row = {
  workout_id: string;
  day_of_week: number | null;
  week_number: number | null;
  sort_order: number;
  workouts: { name: string; plan_session: PlanCardData | null } | null;
};

const SELECT = "workout_id, day_of_week, week_number, sort_order, workouts(name, plan_session)";

function toSession(r: Row): WeekSession | null {
  if (r.day_of_week == null) return null;
  return {
    workoutId: r.workout_id,
    name: r.workouts?.name ?? "Session",
    day: r.day_of_week,
    sortOrder: r.sort_order,
    plan: r.workouts?.plan_session ?? null,
  };
}

// A session with no week repeats every week; one with a week counts only in
// that week.
export async function loadWeekSessions(programmeId: string, week: number): Promise<WeekSession[]> {
  const { data } = await supabaseAdmin
    .from("programme_workouts")
    .select(SELECT)
    .eq("programme_id", programmeId)
    .returns<Row[]>();
  return (data ?? [])
    .filter((r) => r.week_number == null || r.week_number === week)
    .map(toSession)
    .filter((s): s is WeekSession => s !== null)
    .sort((a, b) => a.day - b.day || a.sortOrder - b.sortOrder);
}

export async function loadAllSessions(programmeId: string): Promise<(WeekSession & { week: number | null })[]> {
  const { data } = await supabaseAdmin
    .from("programme_workouts")
    .select(SELECT)
    .eq("programme_id", programmeId)
    .returns<Row[]>();
  return (data ?? [])
    .map((r) => {
      const s = toSession(r);
      return s ? { ...s, week: r.week_number } : null;
    })
    .filter((s): s is WeekSession & { week: number | null } => s !== null);
}

// True once any session is tied to a particular week, which is what makes a
// programme use the week view.
export async function programmeHasWeekSessions(programmeId: string): Promise<boolean> {
  const { count } = await supabaseAdmin
    .from("programme_workouts")
    .select("id", { count: "exact", head: true })
    .eq("programme_id", programmeId)
    .not("week_number", "is", null);
  return (count ?? 0) > 0;
}

// "Repeat this week", plain or via the flare box. Pushes the rest of the
// programme back a week by moving its start date on, and records the event
// so it shows in David's log. Nothing in the programme's content changes.
export async function repeatProgrammeWeek(
  programmeId: string,
  patientId: string,
  weekNumber: number,
  kind: "repeat_week" | "flare_up"
): Promise<void> {
  const { data: programme } = await supabaseAdmin
    .from("programmes")
    .select("start_date")
    .eq("id", programmeId)
    .maybeSingle<{ start_date: string }>();
  if (!programme) throw new Error("Programme not found.");

  const next = new Date(programme.start_date);
  next.setDate(next.getDate() + 7);
  const { error: updateError } = await supabaseAdmin
    .from("programmes")
    .update({ start_date: next.toISOString(), updated_at: new Date().toISOString() })
    .eq("id", programmeId);
  if (updateError) throw new Error(updateError.message);

  const { error: eventError } = await supabaseAdmin
    .from("programme_events")
    .insert({ programme_id: programmeId, patient_id: patientId, kind, week_number: weekNumber });
  if (eventError) throw new Error(eventError.message);
}
