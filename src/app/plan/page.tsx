import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentPlanWeekNumber, findPlanWeek, isFirstPlanWeek, adjacentPlanWeek } from "@/lib/athenaPlanWeek";
import type { AthenaPlanV1 } from "@/lib/athenaPlan";
import PlanWeekView from "./PlanWeekView";
import PlanMorningCheckinPrompt from "./PlanMorningCheckinPrompt";
import styles from "../session/TodaySession.module.css";
import { getClinicSettings } from "@/lib/clinicSettings";

export const dynamic = "force-dynamic";

type ImportedPlanRow = { id: string; raw_json: AthenaPlanV1; effective_start_date: string };

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/start");

  // Hidden, not removed: the separate plan calendar is behind a switch in
  // Tools, Feature settings (off by default).
  const { legacyPlanCalendarEnabled } = await getClinicSettings();
  if (!legacyPlanCalendarEnabled) redirect("/session");

  const { data: plan } = await supabase
    .from("imported_plans")
    .select("id, raw_json, effective_start_date")
    .eq("patient_id", user.id)
    .eq("status", "assigned")
    .maybeSingle<ImportedPlanRow>();
  if (!plan) notFound();

  const athenaPlan = plan.raw_json;
  const { week: weekParam } = await searchParams;
  const parsedWeek = weekParam ? parseInt(weekParam, 10) : NaN;
  const requestedWeek = Number.isInteger(parsedWeek) && findPlanWeek(athenaPlan, parsedWeek) ? parsedWeek : null;
  const weekNumber = requestedWeek ?? currentPlanWeekNumber(athenaPlan, plan.effective_start_date);
  const week = findPlanWeek(athenaPlan, weekNumber);
  if (!week) notFound();

  const { data: logRows } = await supabase
    .from("plan_session_logs")
    .select("id, session_id, completed_quality, pain_score, completed_at, next_morning_answer")
    .eq("imported_plan_id", plan.id)
    .returns<{ id: string; session_id: string; completed_quality: string | null; pain_score: number | null; completed_at: string; next_morning_answer: string | null }[]>();
  const allLogs = logRows ?? [];

  // The next-morning question -- the most recent logged, non-strength
  // session from an earlier calendar day with no answer yet.
  const sessionTypeById = new Map(athenaPlan.weeks.flatMap((w) => w.sessions.map((s) => [s.id, s.type])));
  const today = new Date();
  const pendingCheckin = allLogs
    .filter((l) => l.completed_quality && !l.next_morning_answer && sessionTypeById.get(l.session_id) !== "strength")
    .filter((l) => {
      const d = new Date(l.completed_at);
      return d.toDateString() !== today.toDateString() && d < today;
    })
    .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())[0];

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        {pendingCheckin && <PlanMorningCheckinPrompt logId={pendingCheckin.id} />}
        <PlanWeekView
          importedPlanId={plan.id}
          blockTitle={athenaPlan.block_title}
          intro={athenaPlan.intro}
          week={week}
          currentWeekNumber={weekNumber}
          totalWeeks={athenaPlan.weeks.length}
          prevWeek={adjacentPlanWeek(athenaPlan, weekNumber, "prev")}
          nextWeek={adjacentPlanWeek(athenaPlan, weekNumber, "next")}
          isFirstWeek={isFirstPlanWeek(athenaPlan, weekNumber)}
          flareRuleText={athenaPlan.rules.flare}
          moveOnText={athenaPlan.rules.move_on}
          logs={allLogs.map((l) => ({ session_id: l.session_id, completed_quality: l.completed_quality as "finished" | "partial" | "not_done" | null }))}
        />
      </div>
    </div>
  );
}
