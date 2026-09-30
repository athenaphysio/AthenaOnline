import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { AthenaPlanV1 } from "@/lib/athenaPlan";
import { currentPlanWeekNumber } from "@/lib/athenaPlanWeek";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const QUALITY_LABEL: Record<string, string> = { finished: "yes", partial: "partly", not_done: "no" };
const MORNING_LABEL: Record<string, string> = { better: "better", same: "same", worse: "worse" };

// David's "Copy log for Claude" button, on the client's clinic page. A
// plain-text summary of one assigned plan -- what's been logged, week by
// week, plus every repeat and flare-up -- meant to be pasted straight
// into a Claude chat that's already reviewing this client's progress.
export async function buildClaudeLogText(importedPlanId: string): Promise<string> {
  const { data: planRow } = await supabaseAdmin
    .from("imported_plans")
    .select("raw_json, patient_id, effective_start_date")
    .eq("id", importedPlanId)
    .maybeSingle<{ raw_json: AthenaPlanV1; patient_id: string; effective_start_date: string }>();
  if (!planRow) return "Plan not found.";
  const plan = planRow.raw_json;

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("first_name, last_name")
    .eq("id", planRow.patient_id)
    .maybeSingle<{ first_name: string; last_name: string | null }>();
  const clientName = patient ? `${patient.first_name}${patient.last_name ? ` ${patient.last_name}` : ""}` : plan.client_name;

  const [{ data: logRows }, { data: eventRows }, { data: completions }] = await Promise.all([
    supabaseAdmin
      .from("plan_session_logs")
      .select("session_id, completed_quality, pain_score, note, next_morning_answer")
      .eq("imported_plan_id", importedPlanId)
      .returns<{ session_id: string; completed_quality: string | null; pain_score: number | null; note: string | null; next_morning_answer: string | null }[]>(),
    supabaseAdmin
      .from("plan_events")
      .select("kind, week_number")
      .eq("imported_plan_id", importedPlanId)
      .returns<{ kind: string; week_number: number }[]>(),
    // Strength sessions delegate entirely to the client's existing, real
    // programme (Step 3) -- there's no id linking a plan session to a
    // specific old-system workout, so "completed" here is a reasonable
    // proxy: did they log anything at all against their normal programme
    // during that calendar week.
    supabaseAdmin
      .from("session_completions")
      .select("occurred_at")
      .eq("patient_id", planRow.patient_id)
      .eq("status", "completed")
      .returns<{ occurred_at: string }[]>(),
  ]);
  const logBySessionId = new Map((logRows ?? []).map((r) => [r.session_id, r]));
  const repeatedWeeks = (eventRows ?? []).filter((e) => e.kind === "repeat_week").map((e) => e.week_number);
  const flareWeeks = (eventRows ?? []).filter((e) => e.kind === "flare_up").map((e) => e.week_number);

  function strengthDoneInWeek(weekNumber: number): boolean {
    const weekStart = new Date(planRow!.effective_start_date);
    weekStart.setDate(weekStart.getDate() + (weekNumber - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return (completions ?? []).some((c) => {
      const d = new Date(c.occurred_at);
      return d >= weekStart && d < weekEnd;
    });
  }

  const currentWeek = currentPlanWeekNumber(plan, planRow.effective_start_date);
  const lines: string[] = [];
  lines.push(`Client: ${clientName}`);
  lines.push(`Plan: ${plan.block_title} (start ${formatDate(plan.start_date)})`);

  for (const week of [...plan.weeks].sort((a, b) => a.week - b.week)) {
    if (week.week > currentWeek) continue;
    const sessions = [...week.sessions].sort((a, b) => a.order - b.order);
    const linesForWeek: string[] = [];

    for (const session of sessions) {
      if (session.type === "strength") {
        linesForWeek.push(`- ${session.title}: ${strengthDoneInWeek(week.week) ? "completed" : "not yet"}`);
        continue;
      }
      const log = logBySessionId.get(session.id);
      if (!log) continue;
      const parts: string[] = [];
      if (log.completed_quality) parts.push(`finished ${QUALITY_LABEL[log.completed_quality]}`);
      if (log.pain_score != null) parts.push(`pain ${log.pain_score}/10`);
      if (log.next_morning_answer) parts.push(`next morning ${MORNING_LABEL[log.next_morning_answer]}`);
      let line = `- ${session.title}: ${parts.join(", ")}`;
      if (log.note) line += `. Note: "${log.note}"`;
      linesForWeek.push(line);
    }

    if (linesForWeek.length === 0) continue;
    lines.push(`Week ${week.week}`);
    lines.push(...linesForWeek);
  }

  lines.push(`Weeks repeated: ${repeatedWeeks.length ? repeatedWeeks.map((w) => `week ${w}`).join(", ") : "none"}`);
  lines.push(`Flare-ups: ${flareWeeks.length ? flareWeeks.map((w) => `week ${w}`).join(", ") : "none"}`);

  return lines.join("\n");
}
