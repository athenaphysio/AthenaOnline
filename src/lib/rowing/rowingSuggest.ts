import type { RowingCardMeta } from "@/lib/rowing/rowingPlan";
import { formatSplit, referenceFromTest, SPORT_TEXT, type Sport } from "@/lib/rowing/zones";

// Reads a client's recent PM5 rows against their plan and drafts
// suggestions for Dr David Silver PhD to approve or hold. Pure: no database
// here, so the rules can be read and tested on their own. Nothing this
// file returns ever changes a plan by itself.
//
// DRAFT RULES FOR DR DAVID SILVER PhD TO CHECK. Every threshold below is a
// starting point and is gathered in RULES so it can be tuned in one place.

export const RULES = {
  /** A row this close to 20:00 (seconds either side) counts as a 20 minute test. */
  testWindowSeconds: 5,
  /** Only suggest a new test pace if it differs from the current one by this much. */
  testMinChangeSeconds: 1,
  /** A 20 minute piece slower than the current test split by more than this was not a test effort. */
  testEffortMarginSeconds: 3,
  /** Steady rows this many seconds quicker than the fast edge count as comfortably quick. */
  quickMarginSeconds: 2,
  /** How many recent steady rows must all be comfortably quick. */
  quickCount: 3,
  quickWithinDays: 21,
  pacesUpBySeconds: 1.5,
  /** Rows this many seconds slower than the slow edge count as a struggle. */
  slowMarginSeconds: 3,
  slowLookback: 4,
  slowCount: 2,
  /** Partial or not done practices, or worse next mornings, in this window. */
  logWindowDays: 10,
  logSignalCount: 2,
  pacesDownBySeconds: 2,
  /** Don't raise the same kind again within this many days of David answering one. */
  quietDays: 7,
};

export type ResultLite = {
  id: string;
  rowedOn: string; // YYYY-MM-DD
  distanceM: number;
  timeSeconds: number;
  avgSplit: number;
  workoutType: string | null;
  strokeRate: number | null;
  avgHr: number | null;
};

export type PlanCardLite = { week: number; day: number; meta: RowingCardMeta };

export type LogLite = { completedOn: string; quality: string | null; morning: string | null; pain: number | null };

export type MatchedRow = ResultLite & { week: number; day: number; meta: RowingCardMeta | null };

export type Kind = "new_test" | "paces_up" | "paces_down" | "hold_week";

export type SuggestionDraft = {
  kind: Kind;
  from: number;
  to: number | null;
  reason: string;
  evidence: { date: string; text: string }[];
  sourceResultId: string | null;
};

function dayIndex(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000);
}

/** Which programme week and weekday a date falls on, the same way the client's week view counts them. */
export function weekAndDay(programmeStart: string, date: string): { week: number; day: number } {
  const start = programmeStart.slice(0, 10);
  const diff = dayIndex(start, date);
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return { week: Math.floor(diff / 7) + 1, day: d === 0 ? 7 : d };
}

export function matchRows(programmeStart: string, results: ResultLite[], cards: PlanCardLite[]): MatchedRow[] {
  return results.map((r) => {
    const { week, day } = weekAndDay(programmeStart, r.rowedOn);
    const card = cards.find((c) => c.week === week && c.day === day) ?? null;
    return { ...r, week, day, meta: card?.meta ?? null };
  });
}

/**
 * A row typed in by hand and ticked as a test always counts. Otherwise a
 * single 20 minute piece counts only when it was rowed near test effort,
 * so an easy 20 minute steady row is never mistaken for a slower test.
 */
export function isTest(sport: Sport, r: ResultLite, reference: number): boolean {
  if (sport === "run") return r.workoutType === "ManualTest";
  return isTwentyMinuteTest(r, reference);
}

/** The reference pace a test result sets: the 20 minute split, or 5K pace for running. */
export function referenceFromResult(sport: Sport, r: ResultLite): number {
  if (sport === "row") return r.avgSplit;
  return referenceFromTest("run", r.distanceM, r.timeSeconds);
}

export function isTwentyMinuteTest(r: ResultLite, reference: number): boolean {
  if (r.workoutType === "ManualTest") return true;
  if (Math.abs(r.timeSeconds - 1200) > RULES.testWindowSeconds) return false;
  if (r.avgSplit > reference + RULES.testEffortMarginSeconds) return false;
  return !r.workoutType || ["JustRow", "FixedTimeSplits", "unknown"].includes(r.workoutType);
}

export function describeRow(r: MatchedRow, sport: Sport = "row"): string {
  const vs = r.meta && r.meta.role !== "test" ? `, planned ${formatSplit(r.meta.fast)} to ${formatSplit(r.meta.slow)}` : "";
  return `${Math.round(r.distanceM).toLocaleString("en-GB")}m at ${formatSplit(r.avgSplit)} ${SPORT_TEXT[sport].unit}${vs}`;
}

export type SuggestContext = {
  sport?: Sport;
  today: string;
  reference: number;
  /** The date the current reference split came into force. */
  referenceSince: string;
  slackWeeks: number;
  rows: MatchedRow[];
  logs: LogLite[];
  pendingKinds: Kind[];
  recentlyAnswered: { kind: Kind; resolvedOn: string }[];
  usedTestResultIds: string[];
};

export function suggest(ctx: SuggestContext): SuggestionDraft[] {
  const out: SuggestionDraft[] = [];
  const blocked = (kind: Kind) =>
    ctx.pendingKinds.includes(kind) ||
    ctx.recentlyAnswered.some((a) => a.kind === kind && dayIndex(a.resolvedOn, ctx.today) < RULES.quietDays) ||
    out.some((o) => o.kind === kind);

  const sport: Sport = ctx.sport ?? "row";
  const unit = SPORT_TEXT[sport].unit;
  // Pace thresholds are per 500m for rowing; a km of running is roughly
  // twice as long, so the same rules use twice the seconds.
  const k = sport === "run" ? 2 : 1;
  const rows = [...ctx.rows].sort((a, b) => (a.rowedOn < b.rowedOn ? 1 : -1)); // newest first

  // 1. A retest.
  const test = rows.find(
    (r) => isTest(sport, r, ctx.reference) && r.rowedOn > ctx.referenceSince && !ctx.usedTestResultIds.includes(r.id)
  );
  const testRef = test ? Math.round(referenceFromResult(sport, test) * 10) / 10 : null;
  if (test && testRef != null && Math.abs(testRef - ctx.reference) >= RULES.testMinChangeSeconds * k && !blocked("new_test")) {
    const quicker = testRef < ctx.reference;
    const what = sport === "row" ? "A 20 minute row" : `A ${Math.round(test.distanceM).toLocaleString("en-GB")}m time trial`;
    const refName = sport === "row" ? "test split" : "5K pace";
    out.push({
      kind: "new_test",
      from: ctx.reference,
      to: testRef,
      reason: quicker
        ? `${what} on ${test.rowedOn} puts the ${refName} at ${formatSplit(testRef)} ${unit}, quicker than the ${formatSplit(ctx.reference)} the plan is set from. Approving resets every pace from this test.`
        : `${what} on ${test.rowedOn} puts the ${refName} at ${formatSplit(testRef)} ${unit}, slower than the ${formatSplit(ctx.reference)} the plan is set from. It may not have been an all out effort, so worth checking before approving.`,
      evidence: [{ date: test.rowedOn, text: describeRow(test, sport) }],
      sourceResultId: test.id,
    });
  }

  // 2. Steady rows sitting comfortably quicker than their range.
  const steady = rows
    .filter((r) => r.meta && (r.meta.role === "long" || r.meta.role === "steady") && r.rowedOn > ctx.referenceSince)
    .filter((r) => dayIndex(r.rowedOn, ctx.today) <= RULES.quickWithinDays)
    .slice(0, RULES.quickCount);
  const recentWorse = ctx.logs.filter((l) => l.morning === "worse" && dayIndex(l.completedOn, ctx.today) <= 7).length;
  if (
    steady.length === RULES.quickCount &&
    steady.every((r) => r.avgSplit < (r.meta as RowingCardMeta).fast - RULES.quickMarginSeconds * k) &&
    recentWorse === 0 &&
    !blocked("paces_up") &&
    !out.some((o) => o.kind === "new_test")
  ) {
    out.push({
      kind: "paces_up",
      from: ctx.reference,
      to: Math.round((ctx.reference - RULES.pacesUpBySeconds * k) * 10) / 10,
      reason: `The last ${RULES.quickCount} steady ${SPORT_TEXT[sport].noun}s were all more than ${RULES.quickMarginSeconds * k} seconds ${unit === "/km" ? "per km" : "per 500m"} quicker than their range, with no worse next mornings. Approving moves every pace on by ${RULES.pacesUpBySeconds * k} seconds ${unit === "/km" ? "per km" : "per 500m"}. A fresh ${sport === "row" ? "20 minute test" : "time trial"} would be the more precise alternative.`,
      evidence: steady.map((r) => ({ date: r.rowedOn, text: describeRow(r, sport) })),
      sourceResultId: null,
    });
  }

  // 3. Signs the plan is running ahead of the client.
  const lastFew = rows.filter((r) => r.meta && r.meta.role !== "event").slice(0, RULES.slowLookback);
  const slowRows = lastFew.filter((r) => r.avgSplit > (r.meta as RowingCardMeta).slow + RULES.slowMarginSeconds * k);
  const windowLogs = ctx.logs.filter((l) => dayIndex(l.completedOn, ctx.today) <= RULES.logWindowDays);
  const unfinished = windowLogs.filter((l) => l.quality === "partial" || l.quality === "not_done");
  const worse = windowLogs.filter((l) => l.morning === "worse");
  const evidence: SuggestionDraft["evidence"] = [
    ...slowRows.map((r) => ({ date: r.rowedOn, text: describeRow(r, sport) })),
    ...unfinished.map((l) => ({ date: l.completedOn, text: l.quality === "partial" ? "Logged as partly done" : "Logged as not done" })),
    ...worse.map((l) => ({ date: l.completedOn, text: "Next morning logged as worse" })),
  ];
  const struggling =
    slowRows.length >= RULES.slowCount || unfinished.length >= RULES.logSignalCount || worse.length >= RULES.logSignalCount;
  if (struggling) {
    const parts: string[] = [];
    if (slowRows.length >= RULES.slowCount) parts.push(`${slowRows.length} of the last ${lastFew.length} ${SPORT_TEXT[sport].noun}s were more than ${RULES.slowMarginSeconds * k} seconds ${unit === "/km" ? "per km" : "per 500m"} slower than planned`);
    if (unfinished.length >= RULES.logSignalCount) parts.push(`${unfinished.length} practices in the last ${RULES.logWindowDays} days were logged as partly done or not done`);
    if (worse.length >= RULES.logSignalCount) parts.push(`${worse.length} next mornings were logged as worse`);
    const what = parts.join("; ");
    if (ctx.slackWeeks > 0 && !blocked("hold_week")) {
      out.push({
        kind: "hold_week",
        from: ctx.reference,
        to: null,
        reason: `${capitalise(what)}. There is ${ctx.slackWeeks} spare week${ctx.slackWeeks === 1 ? "" : "s"} before the event, so approving repeats the current week and moves the rest of the plan back by one.`,
        evidence,
        sourceResultId: null,
      });
    } else if (!blocked("paces_down")) {
      out.push({
        kind: "paces_down",
        from: ctx.reference,
        to: Math.round((ctx.reference + RULES.pacesDownBySeconds * k) * 10) / 10,
        reason: `${capitalise(what)}. There is no spare week before the event, so approving eases every pace by ${RULES.pacesDownBySeconds * k} seconds ${unit === "/km" ? "per km" : "per 500m"} instead of repeating a week.`,
        evidence,
        sourceResultId: null,
      });
    }
  }

  return out;
}

function capitalise(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
