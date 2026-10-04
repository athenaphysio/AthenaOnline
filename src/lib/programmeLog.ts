import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { currentWeekNumber } from "@/lib/programmeWeek";
import { loadAllSessions } from "@/lib/programmeCards";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const QUALITY_LABEL: Record<string, string> = { finished: "yes", partial: "partly", not_done: "no" };
const MORNING_LABEL: Record<string, string> = { better: "better", same: "same", worse: "worse" };
const DAY_NAME = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// "Copy log for Claude" for a client's programme: a plain-text summary of
// what has been logged, week by week, across cardio cards and strength
// sessions, plus every repeat and flare-up -- meant to be pasted into a
// Claude chat that is reviewing this client's progress.
export async function buildProgrammeLogText(programmeId: string): Promise<string> {
  const { data: programme } = await supabaseAdmin
    .from("programmes")
    .select("title, start_date, block_length_weeks, patient_id")
    .eq("id", programmeId)
    .maybeSingle<{ title: string; start_date: string; block_length_weeks: number; patient_id: string }>();
  if (!programme) return "Programme not found.";

  const [{ data: patient }, sessions, { data: logRows }, { data: eventRows }, { data: completions }] = await Promise.all([
    supabaseAdmin
      .from("patients")
      .select("first_name, last_name")
      .eq("id", programme.patient_id)
      .maybeSingle<{ first_name: string; last_name: string | null }>(),
    loadAllSessions(programmeId),
    supabaseAdmin
      .from("programme_card_logs")
      .select("workout_id, week_number, completed_quality, pain_score, note, next_morning_answer")
      .eq("programme_id", programmeId)
      .returns<
        { workout_id: string; week_number: number; completed_quality: string | null; pain_score: number | null; note: string | null; next_morning_answer: string | null }[]
      >(),
    supabaseAdmin
      .from("programme_events")
      .select("kind, week_number")
      .eq("programme_id", programmeId)
      .returns<{ kind: string; week_number: number }[]>(),
    supabaseAdmin
      .from("session_completions")
      .select("week_number, day_of_week")
      .eq("programme_id", programmeId)
      .eq("status", "completed")
      .returns<{ week_number: number; day_of_week: number }[]>(),
  ]);

  const clientName = patient ? `${patient.first_name}${patient.last_name ? ` ${patient.last_name}` : ""}` : "Client";
  const logByKey = new Map((logRows ?? []).map((l) => [`${l.workout_id}:${l.week_number}`, l]));
  const strengthDone = new Set((completions ?? []).map((c) => `${c.week_number}:${c.day_of_week}`));
  const repeatedWeeks = (eventRows ?? []).filter((e) => e.kind === "repeat_week").map((e) => e.week_number);
  const flareWeeks = (eventRows ?? []).filter((e) => e.kind === "flare_up").map((e) => e.week_number);

  const currentWeek = currentWeekNumber(programme.start_date, programme.block_length_weeks);
  const lines: string[] = [];
  lines.push(`Client: ${clientName}`);
  lines.push(`Programme: ${programme.title} (start ${formatDate(programme.start_date)})`);

  for (let week = 1; week <= currentWeek; week++) {
    const inWeek = sessions
      .filter((s) => s.week == null || s.week === week)
      .sort((a, b) => a.day - b.day || a.sortOrder - b.sortOrder);
    const weekLines: string[] = [];

    for (const s of inWeek) {
      const dayName = DAY_NAME[s.day - 1];
      if (s.plan?.type === "strength") continue;
      if (!s.plan) {
        weekLines.push(`- ${s.name} (${dayName}): ${strengthDone.has(`${week}:${s.day}`) ? "completed" : "not yet"}`);
        continue;
      }
      const log = logByKey.get(`${s.workoutId}:${week}`);
      if (!log) continue;
      const parts: string[] = [];
      if (log.completed_quality) parts.push(`finished ${QUALITY_LABEL[log.completed_quality]}`);
      if (log.pain_score != null) parts.push(`pain ${log.pain_score}/10`);
      if (log.next_morning_answer) parts.push(`next morning ${MORNING_LABEL[log.next_morning_answer]}`);
      let line = `- ${s.plan.title || s.name} (${dayName}): ${parts.join(", ")}`;
      if (log.note) line += `. Note: "${log.note}"`;
      weekLines.push(line);
    }

    if (weekLines.length === 0) continue;
    lines.push(`Week ${week}`);
    lines.push(...weekLines);
  }

  lines.push(`Weeks repeated: ${repeatedWeeks.length ? repeatedWeeks.map((w) => `week ${w}`).join(", ") : "none"}`);
  lines.push(`Flare-ups: ${flareWeeks.length ? flareWeeks.map((w) => `week ${w}`).join(", ") : "none"}`);
  return lines.join("\n");
}
