import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { RowingContext } from "@/lib/rowing/rowingServer";
import { baselineReference, buildRowingPlan, eventDistanceFor, referenceDistance } from "@/lib/rowing/rowingPlan";
import { isTest, referenceFromResult } from "@/lib/rowing/rowingSuggest";
import { pathAt } from "@/lib/rowing/goal";
import { formatDuration, predictedPace, timeFromPace } from "@/lib/rowing/zones";
import { formatMeasure, type GoalPath, type PathPoint } from "@/lib/rowing/goalPath";

export type { GoalPath, PathPoint };
import { sessionDate } from "@/lib/programmeWeek";
import { strengthStrandFor } from "@/lib/strengthStrandServer";

// How well a client is on target, from three strands read side by side:
//   Fitness  - their tests against the straight path from baseline to goal
//   Practice - sessions logged against sessions planned so far
//   Feel     - how practices have been logged, and Dr David Silver PhD's
//              own one tap read of their voice notes
// The app never reads the words of a voice note itself, so a client saying
// they weren't sure they were doing it right can never be flagged by it.
//
// DRAFT THRESHOLDS FOR DR DAVID SILVER PhD TO CHECK, gathered in ON_TARGET.

export const ON_TARGET = {
  onPath: 0.005,
  littleBehind: 0.02,
  practiceSteady: 0.85,
  practiceSomeGaps: 0.65,
  feelWindowDays: 14,
  notesWindowDays: 21,
};

export type Tone = "good" | "middle" | "look" | "none";

export type Strand = { label: string; status: string; tone: Tone; detail: string };

export type OnTarget = {
  overall: { status: string; tone: Tone };
  fitness: Strand;
  practice: Strand;
  feel: Strand;
  /** From the client's strength logs (strengthStrand.ts). */
  strength: Strand;
  path: GoalPath;
};

function dayDiff(a: string, b: string): number {
  return Math.round((new Date(`${b.slice(0, 10)}T00:00:00Z`).getTime() - new Date(`${a.slice(0, 10)}T00:00:00Z`).getTime()) / 86400000);
}

/** The client's path to their goal: their tests plotted against the line from baseline to goal. */
export function goalPathFor(ctx: RowingContext): GoalPath {
  const { inputs } = ctx.plan;
  const sport = ctx.sport;
  const distance = eventDistanceFor(inputs);
  const measure: GoalPath["measure"] = distance != null ? "time" : "pace";
  const start = ctx.programme.start_date.slice(0, 10);
  const totalWeeks = ctx.programme.block_length_weeks;

  const valueFor = (reference: number): number => {
    const refDist = referenceDistance(sport, reference);
    if (distance != null) return timeFromPace(sport, predictedPace(sport, reference, refDist, distance), distance);
    // Timed event: plotted as the predicted pace for its length.
    const plan = buildRowingPlan(inputs, reference);
    return plan.ok ? plan.summary.predictedSplit : reference;
  };

  const baseRef = baselineReference(inputs);
  const baseValue = valueFor(baseRef);
  const points: PathPoint[] = [
    { week: 0, value: baseValue, label: "Entry test", date: inputs.testDate, baseline: true },
  ];
  const tests = ctx.rows
    // The slower of today's and the entry reference, so an early test isn't
    // missed just because paces have since moved on.
    .filter((r) => r.rowedOn > inputs.testDate && isTest(sport, r, Math.max(ctx.plan.reference_split_seconds, baseRef)))
    .sort((a, b) => (a.rowedOn < b.rowedOn ? -1 : 1));
  for (const t of tests) {
    const week = Math.max(0, dayDiff(start, t.rowedOn) / 7);
    points.push({ week: Math.min(totalWeeks, week), value: valueFor(referenceFromResult(sport, t)), label: sport === "row" ? "20 minute test" : "Time trial", date: t.rowedOn });
  }

  const goalSeconds = Number(inputs.goalTimeSeconds);
  const goal = distance != null && goalSeconds > 0 ? { value: goalSeconds, label: `Goal ${formatDuration(goalSeconds)}` } : null;
  const currentWeek = Math.max(0, Math.min(totalWeeks, dayDiff(start, new Date().toISOString()) / 7));
  return {
    sport,
    measure,
    totalWeeks,
    currentWeek,
    points,
    goal,
    expectedNow: goal ? pathAt(baseValue, goal.value, totalWeeks, currentWeek) : null,
    eventName: inputs.eventName,
  };
}

export async function onTargetFor(ctx: RowingContext): Promise<OnTarget> {
  const path = goalPathFor(ctx);
  const fitness = fitnessStrand(ctx, path);
  const practice = await practiceStrand(ctx);
  const feel = await feelStrand(ctx);
  const strength = await strengthStrandFor(ctx.programme.id);

  let overall: OnTarget["overall"];
  if (fitness.tone === "look" || feel.tone === "look" || strength.tone === "look") overall = { status: "Worth a conversation", tone: "look" };
  else if (fitness.tone === "middle" || practice.tone !== "good" || feel.tone === "middle") overall = { status: "Close to track", tone: "middle" };
  else overall = { status: "On track", tone: "good" };
  if (practice.tone === "none" && fitness.tone === "none" && feel.tone === "none") overall = { status: "Too early to tell", tone: "none" };

  return { overall, fitness, practice, feel, strength, path };
}

function fitnessStrand(ctx: RowingContext, path: GoalPath): Strand {
  const latest = path.points[path.points.length - 1];
  const baseline = path.points[0];
  const testName = ctx.sport === "row" ? "20 minute test" : "time trial";
  if (path.points.length === 1) {
    const plan = buildRowingPlan(ctx.plan.inputs);
    const next = plan.ok ? plan.summary.testWeeks.find((w) => w > path.currentWeek) : undefined;
    return {
      label: "Fitness",
      status: "No retest yet",
      tone: "none",
      detail: next ? `The first ${testName} in the plan is in week ${next}.` : `No ${testName} has come in since the entry test.`,
    };
  }
  const show = (v: number) => formatMeasure(path, v);
  if (path.goal) {
    const expected = pathAt(baseline.value, path.goal.value, path.totalWeeks, latest.week);
    const dev = (latest.value - expected) / expected;
    const vs = `The ${latest.date} ${testName} predicts ${show(latest.value)}; the path to ${show(path.goal.value)} expected about ${show(expected)} by then.`;
    if (dev <= -ON_TARGET.onPath) return { label: "Fitness", status: "Ahead of the path", tone: "good", detail: vs };
    if (dev <= ON_TARGET.onPath) return { label: "Fitness", status: "On the path", tone: "good", detail: vs };
    if (dev <= ON_TARGET.littleBehind) return { label: "Fitness", status: "A little behind", tone: "middle", detail: vs };
    return { label: "Fitness", status: "Behind the path", tone: "look", detail: vs };
  }
  const change = (latest.value - baseline.value) / baseline.value;
  const vs = `The ${latest.date} ${testName} predicts ${show(latest.value)}, against ${show(baseline.value)} at the entry test.`;
  if (change <= -ON_TARGET.onPath) return { label: "Fitness", status: "Improving", tone: "good", detail: vs };
  if (change <= ON_TARGET.onPath) return { label: "Fitness", status: "Holding steady", tone: "middle", detail: vs };
  return { label: "Fitness", status: "Slower than the entry test", tone: "look", detail: vs };
}

async function practiceStrand(ctx: RowingContext): Promise<Strand> {
  const programmeId = ctx.programme.id;
  const { data: planned } = await supabaseAdmin
    .from("programme_workouts")
    .select("workout_id, day_of_week, week_number, workouts(plan_session)")
    .eq("programme_id", programmeId)
    .returns<{ workout_id: string; day_of_week: number | null; week_number: number | null; workouts: { plan_session: unknown } | null }[]>();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const due = (planned ?? []).filter(
    (p) => p.week_number != null && p.day_of_week != null && sessionDate(ctx.programme.start_date, p.week_number, p.day_of_week) < today
  );
  if (due.length === 0) return { label: "Practice", status: "Nothing due yet", tone: "none", detail: "No sessions have been due yet." };

  const { data: cardLogs } = await supabaseAdmin
    .from("programme_card_logs")
    .select("workout_id, week_number, completed_quality")
    .eq("programme_id", programmeId)
    .returns<{ workout_id: string; week_number: number; completed_quality: string | null }[]>();
  const { data: completions } = await supabaseAdmin
    .from("session_completions")
    .select("week_number, day_of_week, status")
    .eq("programme_id", programmeId)
    .eq("status", "completed")
    .returns<{ week_number: number | null; day_of_week: number | null; status: string }[]>();

  const cardDone = new Set(
    (cardLogs ?? []).filter((l) => l.completed_quality === "finished" || l.completed_quality === "partial").map((l) => `${l.workout_id}:${l.week_number}`)
  );
  const libraryDone = new Set((completions ?? []).map((c) => `${c.week_number}:${c.day_of_week}`));
  let done = 0;
  let recentDue = 0;
  let recentDone = 0;
  const twoWeeksAgo = new Date(today.getTime() - 14 * 86400000);
  for (const p of due) {
    const isCard = p.workouts?.plan_session != null;
    const ok = isCard ? cardDone.has(`${p.workout_id}:${p.week_number}`) : libraryDone.has(`${p.week_number}:${p.day_of_week}`);
    if (ok) done += 1;
    if (sessionDate(ctx.programme.start_date, p.week_number as number, p.day_of_week as number) >= twoWeeksAgo) {
      recentDue += 1;
      if (ok) recentDone += 1;
    }
  }
  const share = done / due.length;
  const detail = `${done} of ${due.length} sessions logged so far${recentDue ? `, ${recentDone} of ${recentDue} in the last two weeks` : ""}.`;
  if (share >= ON_TARGET.practiceSteady) return { label: "Practice", status: "Steady practice", tone: "good", detail };
  if (share >= ON_TARGET.practiceSomeGaps) return { label: "Practice", status: "Some gaps", tone: "middle", detail };
  return { label: "Practice", status: "Several gaps", tone: "look", detail };
}

async function feelStrand(ctx: RowingContext): Promise<Strand> {
  const today = new Date().toISOString().slice(0, 10);
  const recentLogs = ctx.logs.filter((l) => dayDiff(l.completedOn, today) <= ON_TARGET.feelWindowDays);
  const worse = recentLogs.filter((l) => l.morning === "worse").length;
  const unfinished = recentLogs.filter((l) => l.quality === "partial" || l.quality === "not_done").length;

  const since = new Date(Date.now() - ON_TARGET.notesWindowDays * 86400000).toISOString();
  const { data: notes } = await supabaseAdmin
    .from("voice_notes")
    .select("clinician_tag")
    .eq("patient_id", ctx.programme.patient_id)
    .gte("created_at", since)
    .returns<{ clinician_tag: string | null }[]>();
  const tagged = (notes ?? []).filter((n) => n.clinician_tag);
  const watching = tagged.filter((n) => n.clinician_tag === "worth_watching").length;
  const well = tagged.filter((n) => n.clinician_tag === "going_well").length;
  const untagged = (notes ?? []).length - tagged.length;

  const parts: string[] = [];
  parts.push(`${recentLogs.length} practice${recentLogs.length === 1 ? "" : "s"} logged in the last two weeks`);
  if (unfinished) parts.push(`${unfinished} partly done or not done`);
  if (worse) parts.push(`${worse} worse next morning${worse === 1 ? "" : "s"}`);
  if ((notes ?? []).length) {
    parts.push(
      `${(notes ?? []).length} voice note${(notes ?? []).length === 1 ? "" : "s"} in three weeks` +
        (tagged.length ? ` (${well} going well, ${watching} worth watching${untagged ? `, ${untagged} not yet read` : ""})` : untagged ? `, ${untagged} not yet read` : "")
    );
  }
  const detail = `${parts.join("; ")}.`;

  if (recentLogs.length === 0 && (notes ?? []).length === 0) return { label: "How it feels", status: "Nothing logged recently", tone: "none", detail };
  if (worse >= 2 || watching >= 1 || unfinished >= 3) return { label: "How it feels", status: "Worth a look", tone: "look", detail };
  if (worse === 1 || unfinished >= 1) return { label: "How it feels", status: "Mixed", tone: "middle", detail };
  return { label: "How it feels", status: "Settled", tone: "good", detail };
}
