import { formatDuration, type Sport } from "@/lib/rowing/zones";

// Whether a performance goal fits the time available, and the straight
// path from today's predicted time to the goal that later tests are read
// against. Pure, no database.
//
// DRAFT FIGURES FOR DR DAVID SILVER PhD TO CHECK. How quickly improvement
// can reasonably be planned is a judgement, not a law; every number that
// sets the verdict lives in GOAL_RULES so it can be tuned in one place.

export const GOAL_RULES = {
  /** Improvement in event time per week, as a share of today's predicted time. */
  comfortablePerWeek: 0.0035,
  ambitiousPerWeek: 0.006,
  /** Never plan for more than this total improvement in one block, however long. */
  maxTotal: 0.12,
  /** More sessions a week support a faster rate, fewer a slower one. */
  sessionFactor(sessionsPerWeek: number): number {
    if (sessionsPerWeek <= 2) return 0.75;
    if (sessionsPerWeek === 3) return 1;
    if (sessionsPerWeek === 4) return 1.1;
    return 1.2;
  },
};

export type GoalVerdict = "within_reach" | "on_track" | "ambitious" | "not_yet";

export type GoalAssessment = {
  verdict: GoalVerdict;
  predictedSeconds: number;
  goalSeconds: number;
  /** Share of today's predicted time to find, e.g. 0.06 for 6%. */
  gap: number;
  weeks: number;
  realisticSeconds: number;
  stretchSeconds: number;
  /** Weeks needed at the ambitious rate with the current sessions. */
  weeksNeeded: number;
  /** True when one more session a week would move the verdict up a step. */
  extraSessionHelps: boolean;
  headline: string;
  detail: string;
};

function capped(rate: number, weeks: number): number {
  return Math.min(GOAL_RULES.maxTotal, rate * weeks);
}

function verdictFor(gap: number, weeks: number, sessions: number): GoalVerdict {
  const f = GOAL_RULES.sessionFactor(sessions);
  if (gap <= 0) return "within_reach";
  if (gap <= capped(GOAL_RULES.comfortablePerWeek * f, weeks)) return "on_track";
  if (gap <= capped(GOAL_RULES.ambitiousPerWeek * f, weeks)) return "ambitious";
  return "not_yet";
}

const RANK: Record<GoalVerdict, number> = { not_yet: 0, ambitious: 1, on_track: 2, within_reach: 3 };

/** Goal times apply to distance events; a timed event has no goal time. */
export function assessGoal(params: {
  predictedSeconds: number;
  goalSeconds: number;
  weeks: number;
  sessionsPerWeek: number;
}): Omit<GoalAssessment, "headline" | "detail"> {
  const { predictedSeconds, goalSeconds, weeks, sessionsPerWeek } = params;
  const gap = (predictedSeconds - goalSeconds) / predictedSeconds;
  const f = GOAL_RULES.sessionFactor(sessionsPerWeek);
  const verdict = verdictFor(gap, weeks, sessionsPerWeek);
  const realisticSeconds = predictedSeconds * (1 - capped(GOAL_RULES.comfortablePerWeek * f, weeks));
  const stretchSeconds = predictedSeconds * (1 - capped(GOAL_RULES.ambitiousPerWeek * f, weeks));
  const weeksNeeded = gap <= 0 ? 0 : Math.ceil(gap / (GOAL_RULES.ambitiousPerWeek * f));
  const extraSessionHelps = RANK[verdictFor(gap, weeks, sessionsPerWeek + 1)] > RANK[verdict];
  return { verdict, predictedSeconds, goalSeconds, gap, weeks, realisticSeconds, stretchSeconds, weeksNeeded, extraSessionHelps };
}

export function describeGoal(a: Omit<GoalAssessment, "headline" | "detail">, sport: Sport, goalLabel: string): { headline: string; detail: string } {
  const pct = `${(Math.abs(a.gap) * 100).toFixed(1)}%`;
  const today = formatDuration(a.predictedSeconds);
  const goal = formatDuration(a.goalSeconds);
  const noun = sport === "row" ? "rowing" : "running";
  switch (a.verdict) {
    case "within_reach":
      return {
        headline: "Within reach already",
        detail: `The test predicts about ${today} today, already at or quicker than ${goal}. The plan will hold this pace comfortably; a quicker goal could be worth discussing.`,
      };
    case "on_track":
      return {
        headline: "On track",
        detail: `The test predicts about ${today} today, so ${goalLabel} asks for ${pct} improvement over ${a.weeks} weeks of ${noun}, which fits comfortably.`,
      };
    case "ambitious":
      return {
        headline: "Ambitious",
        detail: `The test predicts about ${today} today, so ${goalLabel} asks for ${pct} over ${a.weeks} weeks. It is possible, but needs most weeks to go well. Around ${formatDuration(a.realisticSeconds)} is the more comfortable target by that date${a.extraSessionHelps ? ", and one more session a week would make the goal itself more comfortable" : ""}.`,
      };
    default:
      return {
        headline: "Not yet realistic",
        detail: `The test predicts about ${today} today, so ${goalLabel} asks for ${pct} over ${a.weeks} weeks, more than this plan can sensibly build. Around ${formatDuration(a.realisticSeconds)} fits by that date, ${formatDuration(a.stretchSeconds)} at a stretch; ${goal} needs about ${a.weeksNeeded} weeks${a.extraSessionHelps ? ", or one more session a week" : ""}.`,
      };
  }
}

/** Where the path says the client should be, in predicted event seconds, at a given week. */
export function pathAt(baselineSeconds: number, goalSeconds: number, totalWeeks: number, week: number): number {
  const w = Math.max(0, Math.min(totalWeeks, week));
  return baselineSeconds + ((goalSeconds - baselineSeconds) * w) / Math.max(1, totalWeeks);
}
