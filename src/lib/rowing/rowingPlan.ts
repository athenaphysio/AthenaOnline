import type { PlanCardData } from "@/lib/planToBuilder";
import {
  DEFAULT_ZONE_OFFSETS,
  SPORT_TEXT,
  ZONE_INFO,
  bandText,
  cleanOffsets,
  cleanSport,
  eventBand,
  formatDuration,
  formatSplit,
  predictedDistanceForTime,
  predictedPace,
  referenceFromTest,
  timeFromPace,
  zoneBand,
  type Sport,
  type ZoneBand,
  type ZoneId,
  type ZoneOffsets,
} from "@/lib/rowing/zones";
import { assessGoal, describeGoal, type GoalAssessment } from "@/lib/rowing/goal";

// The Rowing and Running Builder's plan engine. Pure calculation only, no
// database and no AI, so the same inputs always give the same plan; that is
// what lets a pace change later rewrite just the paces on cards already in
// a client's programme (matched by each card's stable key) without moving
// anything Dr David Silver PhD has rearranged by hand.
//
// (The file and type names still say "rowing" because rowing came first;
// everything here handles running too, chosen by inputs.sport.)

export type DayMode = "none" | "row" | "strength" | "both";

export type RowingDay = { day: number; mode: DayMode; minutes: number };

export type RowingEventKind = "5k" | "10k" | "half_marathon" | "marathon" | "custom_distance" | "custom_time";

export type RowingInputs = {
  /** Missing means rowing, for plans made before running was added. */
  sport?: Sport;
  clientFirstName: string;
  /** YYYY-MM-DD. The plan starts on the Monday of this week. */
  startDate: string;
  /** YYYY-MM-DD */
  eventDate: string;
  eventKind: RowingEventKind;
  eventName: string;
  /** For custom_distance (metres). */
  eventDistanceM?: number | null;
  /** For custom_time (minutes). */
  eventMinutes?: number | null;
  /** Optional performance goal for a distance event, in seconds, e.g. 12600 for 3:30:00. */
  goalTimeSeconds?: number | null;
  /** Rowing: metres in the 20 minute test. Running: the time trial or race distance. */
  testDistanceM: number;
  /** Running only: the time trial or race time in seconds. Rowing is always 20 minutes. */
  testTimeSeconds?: number | null;
  /** YYYY-MM-DD */
  testDate: string;
  /** Longest session the client can do comfortably right now, in minutes. */
  longestRowMinutes: number;
  days: RowingDay[];
  zoneOffsets?: ZoneOffsets;
};

export type RowingRole = "long" | "steady" | "quality" | "speed" | "primer" | "event" | "test";

export type RowingCardMeta = {
  key: string;
  role: RowingRole;
  zone: ZoneId;
  /** Work only, not warm up or cool down. */
  workSeconds: number;
  pieces: number;
  pieceSeconds: number;
  restSeconds: number;
  fast: number;
  slow: number;
};

export type RowingPlanCard = PlanCardData & { rowing?: RowingCardMeta };

export type RowingCard = { week: number; day: number; order: number; plan: RowingPlanCard };

export type StrengthPhase = "foundation" | "build" | "power";

export type StrengthPlacement = { week: number; day: number; phase: StrengthPhase };

export type RowingPlanSummary = {
  sport: Sport;
  referenceSplit: number;
  eventMinutes: number;
  /** Pace on the day: the goal pace when there is a goal, otherwise today's predicted pace. */
  eventSplit: number;
  predictedSplit: number;
  predictedSeconds: number | null;
  eventDistanceM: number | null;
  goal: GoalAssessment | null;
  totalWeeks: number;
  eventWeekday: number;
  longStart: number;
  longPeak: number;
  longTarget: number;
  status: "comfortable" | "tight" | "short";
  slackWeeks: number;
  testWeeks: number[];
  phases: { name: string; fromWeek: number; toWeek: number }[];
};

export type RowingPlanResult =
  | {
      ok: true;
      mondayStart: string;
      title: string;
      intro: string;
      rules: { move_on: string; flare: string };
      weekLabels: Record<number, string>;
      cards: RowingCard[];
      strength: StrengthPlacement[];
      summary: RowingPlanSummary;
      flags: string[];
    }
  | { ok: false; errors: string[] };

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const STRENGTH_MINUTES = 40;
const WARM_COOL_MINUTES = 10;
const MAX_WEEKS = 30;
const MIN_WEEKS = 4;
const SAFE_RATE = 0.1;
const MAX_RATE = 0.18;
/** A retest goes in a lighter week at least this many weeks after the last one. */
const RETEST_GAP_WEEKS = 6;

export function eventDistanceFor(inputs: Pick<RowingInputs, "eventKind" | "eventDistanceM">): number | null {
  switch (inputs.eventKind) {
    case "5k":
      return 5000;
    case "10k":
      return 10000;
    case "half_marathon":
      return 21097;
    case "marathon":
      return 42195;
    case "custom_distance":
      return inputs.eventDistanceM ?? null;
    default:
      return null;
  }
}

function parseDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function mondayOnOrBefore(value: string): string {
  const d = parseDay(value);
  if (!d) return value;
  const weekday = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (weekday - 1));
  return isoDay(d);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function round5(minutes: number): number {
  return Math.max(5, Math.round(minutes / 5) * 5);
}

function niceDate(value: string): string {
  const d = parseDay(value);
  if (!d) return value;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}

export function metres(n: number): string {
  if (n >= 1000 && n % 1000 === 0) return `${n / 1000}K`;
  return `${Math.round(n).toLocaleString("en-GB")}m`;
}

function circularGap(a: number, b: number): number {
  const g = Math.abs(a - b);
  return Math.min(g, 7 - g);
}

/** The pace every zone comes from, as set by the entry test. */
export function baselineReference(inputs: RowingInputs): number {
  const sport = cleanSport(inputs.sport);
  if (sport === "row") return referenceFromTest("row", inputs.testDistanceM, 1200);
  return referenceFromTest("run", inputs.testDistanceM, Number(inputs.testTimeSeconds));
}

/** The distance the reference pace belongs to, for the prediction rules. */
export function referenceDistance(sport: Sport, reference: number): number {
  return sport === "row" ? (1200 * 500) / reference : 5000;
}

export function validateRowingInputs(inputs: RowingInputs): string[] {
  const sport = cleanSport(inputs.sport);
  const errors: string[] = [];
  const start = parseDay(inputs.startDate);
  const event = parseDay(inputs.eventDate);
  if (!start) errors.push("Choose a start date.");
  if (!event) errors.push("Choose the event date.");
  if (!parseDay(inputs.testDate)) errors.push(sport === "row" ? "Add the date of the 20 minute test." : "Add the date of the time trial or race.");
  if (!inputs.eventName.trim()) errors.push("Give the event a name, for example Half marathon.");
  if (sport === "row") {
    if (!Number.isFinite(inputs.testDistanceM) || inputs.testDistanceM < 2500 || inputs.testDistanceM > 7500) {
      errors.push("The 20 minute test distance should be in metres, somewhere between 2,500 and 7,500.");
    }
  } else {
    const d = Number(inputs.testDistanceM);
    const t = Number(inputs.testTimeSeconds);
    if (!(d >= 1000 && d <= 42195)) errors.push("Add the time trial or race distance, between 1K and a marathon.");
    else if (!(t > 0)) errors.push("Add the time trial or race time.");
    else {
      const pace = (t / d) * 1000;
      if (pace < 150 || pace > 720) errors.push("That time and distance give a pace outside 2:30 to 12:00 per km; worth checking both.");
    }
  }
  if (!Number.isFinite(inputs.longestRowMinutes) || inputs.longestRowMinutes < 0 || inputs.longestRowMinutes > 240) {
    errors.push(`The longest comfortable ${SPORT_TEXT[sport].noun} should be in minutes.`);
  }
  if (inputs.eventKind === "custom_distance" && !(Number(inputs.eventDistanceM) >= 1000)) errors.push("Add the event distance in metres.");
  if (inputs.eventKind === "custom_time" && !(Number(inputs.eventMinutes) >= 10)) errors.push("Add how long the event lasts, in minutes.");
  if (inputs.goalTimeSeconds != null && inputs.goalTimeSeconds !== 0) {
    if (inputs.eventKind === "custom_time") errors.push("A goal time only applies to a distance event.");
    else if (!(inputs.goalTimeSeconds > 0)) errors.push("The goal time couldn't be read; write it like 3:30:00 or 45:00.");
    else {
      const dist = eventDistanceFor(inputs);
      const unit = SPORT_TEXT[sport].unitMetres;
      const pace = dist ? (inputs.goalTimeSeconds * unit) / dist : 0;
      const tooFast = sport === "row" ? 75 : 150;
      const tooSlow = sport === "row" ? 240 : 720;
      if (dist && (pace < tooFast || pace > tooSlow)) errors.push(`The goal time works out at ${formatSplit(pace)} ${SPORT_TEXT[sport].unit}, which looks like a typing slip.`);
    }
  }
  if (start && event) {
    const monday = parseDay(mondayOnOrBefore(inputs.startDate))!;
    const weeks = Math.floor(daysBetween(monday, event) / 7) + 1;
    if (daysBetween(start, event) < 0) errors.push("The event date is before the start date.");
    else if (weeks < MIN_WEEKS) errors.push(`There are only ${weeks} weeks to the event; the builder needs at least ${MIN_WEEKS}.`);
    else if (weeks > MAX_WEEKS) errors.push(`The event is ${weeks} weeks away. Plans go up to ${MAX_WEEKS} weeks, so start this one later.`);
  }
  if (trainingDays(inputs.days).length < 2) errors.push(`Mark at least two days for ${sport === "row" ? "rowing" : "running"}, each with 30 minutes or more.`);
  return errors;
}

type TrainDay = { day: number; minutes: number };

function trainingDays(days: RowingDay[]): TrainDay[] {
  return days
    .filter((d) => d.mode === "row" || d.mode === "both")
    .map((d) => ({ day: d.day, minutes: d.mode === "both" ? d.minutes - STRENGTH_MINUTES : d.minutes }))
    .filter((d) => d.minutes >= 30)
    .sort((a, b) => a.day - b.day);
}

function strengthDays(days: RowingDay[]): number[] {
  return days.filter((d) => d.mode === "strength" || d.mode === "both").map((d) => d.day).sort((a, b) => a - b);
}

/** DRAFT: how long the longest session should peak at, for this sport and event length. */
function longTargetFor(sport: Sport, eventMinutes: number): number {
  if (sport === "row") {
    return round5(eventMinutes >= 60 ? Math.min(eventMinutes * 0.75, 120) : Math.min(75, Math.max(45, eventMinutes * 1.5)));
  }
  if (eventMinutes <= 35) return 60;
  if (eventMinutes <= 70) return 80;
  if (eventMinutes <= 150) return round5(Math.min(120, Math.max(90, eventMinutes)));
  return round5(Math.min(170, eventMinutes * 0.7));
}

type Phase = "base" | "build" | "specific" | "taper" | "event";

type WeekShape = {
  week: number;
  phase: Phase;
  indexInPhase: number;
  countInPhase: number;
  lighter: boolean;
  test: boolean;
  longMinutes: number;
};

/**
 * Builds the whole plan. `referenceSplit` defaults to the entry test; a
 * later approved pace change passes its own value so the same plan is
 * rebuilt with new paces and nothing else changes.
 */
export function buildRowingPlan(inputs: RowingInputs, referenceSplit?: number): RowingPlanResult {
  const errors = validateRowingInputs(inputs);
  if (errors.length) return { ok: false, errors };

  const sport = cleanSport(inputs.sport);
  const text = SPORT_TEXT[sport];
  const offsets = cleanOffsets(sport, inputs.zoneOffsets ?? DEFAULT_ZONE_OFFSETS[sport]);
  const reference = referenceSplit ?? baselineReference(inputs);
  const refDistance = referenceDistance(sport, reference);
  const flags: string[] = [];

  const mondayStart = mondayOnOrBefore(inputs.startDate);
  const monday = parseDay(mondayStart)!;
  const eventDate = parseDay(inputs.eventDate)!;
  const eventIndex = daysBetween(monday, eventDate);
  const totalWeeks = Math.floor(eventIndex / 7) + 1;
  const eventWeekday = (eventIndex % 7) + 1;
  const startWeekday = daysBetween(monday, parseDay(inputs.startDate)!) + 1;

  // What today's fitness predicts for the event, and the pace to aim for.
  const eventDistance = eventDistanceFor(inputs);
  let predictedSplit: number;
  let predictedSeconds: number | null = null;
  if (eventDistance != null) {
    predictedSplit = predictedPace(sport, reference, refDistance, eventDistance);
    predictedSeconds = timeFromPace(sport, predictedSplit, eventDistance);
  } else {
    const seconds = Number(inputs.eventMinutes) * 60;
    const d = predictedDistanceForTime(sport, reference, refDistance, seconds);
    predictedSplit = (seconds * text.unitMetres) / d;
  }
  const hasGoal = eventDistance != null && Number(inputs.goalTimeSeconds) > 0;
  const rowDays = trainingDays(inputs.days);
  let goal: GoalAssessment | null = null;
  // The time the plan actually trains towards: the goal, unless the goal
  // isn't realistic in the time available, in which case the stretch time
  // that is, so nobody is sent out at a pace their fitness can't yet hold.
  let targetSeconds: number | null = null;
  if (hasGoal && predictedSeconds != null) {
    const base = assessGoal({
      predictedSeconds,
      goalSeconds: Number(inputs.goalTimeSeconds),
      weeks: totalWeeks,
      sessionsPerWeek: rowDays.length,
    });
    const words = describeGoal(base, sport, formatDuration(Number(inputs.goalTimeSeconds)));
    goal = { ...base, ...words };
    targetSeconds = goal.verdict === "not_yet" ? goal.stretchSeconds : goal.goalSeconds;
    if (goal.verdict === "not_yet") {
      flags.push(`${goal.headline}. ${goal.detail} The plan trains towards ${formatDuration(targetSeconds)} for now; a later date or more sessions would let it aim for the goal itself.`);
    } else if (goal.verdict === "ambitious") {
      flags.push(`${goal.headline}. ${goal.detail}`);
    }
  }
  const eventSplit = targetSeconds != null ? (targetSeconds * text.unitMetres) / (eventDistance as number) : predictedSplit;
  const eventMinutes = eventDistance != null ? timeFromPace(sport, eventSplit, eventDistance) / 60 : Number(inputs.eventMinutes);

  // Long session: from what the client can do now towards a peak set by
  // the event, and by the goal pace when there is one.
  const longStart = round5(Math.max(20, inputs.longestRowMinutes));
  const longTarget = longTargetFor(sport, eventMinutes);

  const taperWeeks = eventMinutes >= 60 && totalWeeks >= 8 ? 2 : 1;
  const growthWeeks = totalWeeks - taperWeeks;
  const lighterWeeks = new Set<number>();
  for (let w = 4; w < growthWeeks; w += 4) lighterWeeks.add(w);
  const progressingWeeks = growthWeeks - lighterWeeks.size;

  let rate = 0;
  if (longTarget > longStart && progressingWeeks > 1) rate = Math.pow(longTarget / longStart, 1 / (progressingWeeks - 1)) - 1;
  let status: RowingPlanSummary["status"] = "comfortable";
  if (rate > SAFE_RATE) status = "tight";
  if (rate > MAX_RATE) {
    status = "short";
    rate = MAX_RATE;
  }
  let slackWeeks = 0;
  if (status === "comfortable" && longTarget > longStart) {
    const needed = Math.ceil(Math.log(longTarget / longStart) / Math.log(1 + SAFE_RATE)) + 1;
    slackWeeks = Math.max(0, growthWeeks - (needed + Math.floor(needed / 3)));
  } else if (status === "comfortable") {
    slackWeeks = Math.max(0, growthWeeks - 4);
  }

  const baseWeeks = Math.max(1, Math.round(growthWeeks * 0.4));
  const buildWeeks = Math.max(growthWeeks >= 3 ? 1 : 0, Math.round(growthWeeks * 0.35));
  const shapes: WeekShape[] = [];
  let progressed = 0;
  let lastFull = longStart;
  let lastTest = 0;
  const phaseCounters: Record<Phase, number> = { base: 0, build: 0, specific: 0, taper: 0, event: 0 };
  for (let w = 1; w <= totalWeeks; w++) {
    let phase: Phase;
    if (w === totalWeeks) phase = "event";
    else if (w > growthWeeks) phase = "taper";
    else if (w <= baseWeeks) phase = "base";
    else if (w <= baseWeeks + buildWeeks) phase = "build";
    else phase = "specific";
    const lighter = lighterWeeks.has(w);
    const test = lighter && w - lastTest >= RETEST_GAP_WEEKS;
    if (test) lastTest = w;
    let longMinutes: number;
    if (phase === "taper") longMinutes = round5(lastFull * 0.65);
    else if (phase === "event") longMinutes = 0;
    else if (lighter) longMinutes = round5(lastFull * 0.8);
    else {
      longMinutes = round5(Math.min(longTarget, longStart * Math.pow(1 + rate, progressed)));
      lastFull = longMinutes;
      progressed += 1;
    }
    shapes.push({ week: w, phase, indexInPhase: phaseCounters[phase]++, countInPhase: 0, lighter, test, longMinutes });
  }
  for (const s of shapes) s.countInPhase = phaseCounters[s.phase];
  const longPeak = Math.max(...shapes.map((s) => s.longMinutes));
  if (status === "short") {
    flags.push(`There isn't quite enough time to build the long ${text.noun} from ${longStart} to ${longTarget} minutes at a safe rate, so it peaks at ${longPeak} minutes. Worth deciding whether that is enough for this event.`);
  } else if (status === "tight") {
    flags.push(`The long ${text.noun} has to grow by about ${Math.round(rate * 100)}% a week to reach ${longTarget} minutes, faster than the usual 10%. Watch the first few weeks closely.`);
  }

  const longDay = [...rowDays].sort((a, b) => b.minutes - a.minutes || b.day - a.day)[0];
  const others = rowDays.filter((d) => d.day !== longDay.day);
  const qualityDay = [...others].sort((a, b) => circularGap(b.day, longDay.day) - circularGap(a.day, longDay.day) || b.minutes - a.minutes)[0];
  const speedCandidates = others.filter((d) => d.day !== qualityDay?.day);
  const speedDay =
    rowDays.length >= 4
      ? [...speedCandidates].sort(
          (a, b) =>
            Math.min(circularGap(b.day, qualityDay.day), circularGap(b.day, longDay.day)) -
            Math.min(circularGap(a.day, qualityDay.day), circularGap(a.day, longDay.day))
        )[0]
      : undefined;

  if (longDay.minutes - WARM_COOL_MINUTES < longPeak) {
    flags.push(`${DAY_NAMES[longDay.day - 1]} has ${longDay.minutes} minutes, so the long ${text.noun} is held at ${longDay.minutes - WARM_COOL_MINUTES} minutes rather than reaching ${longPeak}. More time that day would let it grow.`);
  }

  const eventWord = inputs.eventName.trim();
  const cards: RowingCard[] = [];
  const strength: StrengthPlacement[] = [];
  const sDays = strengthDays(inputs.days);
  const band = (zone: Exclude<ZoneId, "EVENT">) => zoneBand(reference, zone, offsets);
  // Event pace sessions are never quicker than the slow edge of today's
  // fast zone; a retest that moves the paces on lifts this cap with them.
  const sessionCap = band("TR").slow;
  let capped = false;
  const ctx: CardCtx = { sport, eventWord, reference, refDistance, inputs };

  for (const shape of shapes) {
    const { week, phase } = shape;
    let order = 0;
    const add = (day: number, plan: RowingPlanCard) => {
      if (week === 1 && day < startWeekday) return;
      cards.push({ week, day, order: order++, plan });
    };

    if (phase === "event") {
      const before = rowDays.filter((d) => d.day < eventWeekday - 1);
      const primerDay = before.find((d) => d.day <= eventWeekday - 3);
      if (primerDay) add(primerDay.day, intervalCard(ctx, week, primerDay.day, "primer", eventBand(sport, eventSplit), 3, sport === "row" ? 5 : 3, 2, primerDay.minutes, false));
      const easyDay = [...before].reverse().find((d) => d.day !== primerDay?.day && d.day === eventWeekday - 2);
      if (easyDay) add(easyDay.day, steadyCard(ctx, week, easyDay.day, "steady", band("UT2"), 20, false));
      add(eventWeekday, eventCard(ctx, week, eventWeekday, eventBand(sport, eventSplit), eventMinutes, eventDistance, hasGoal && goal?.verdict !== "not_yet"));
      for (const d of sDays) {
        if (d <= eventWeekday - 4 && strength.filter((s) => s.week === week).length < 1) strength.push({ week, day: d, phase: "power" });
      }
      continue;
    }

    for (const d of rowDays) {
      const cap = d.minutes - WARM_COOL_MINUTES;
      if (d.day === longDay.day) {
        add(d.day, steadyCard(ctx, week, d.day, "long", band("UT2"), Math.min(shape.longMinutes, cap), shape.lighter));
      } else if (d.day === qualityDay?.day) {
        const k = shape.indexInPhase;
        if (shape.test) add(d.day, testCard(ctx, week, d.day));
        else if (phase === "base") {
          add(d.day, intervalCard(ctx, week, d.day, "quality", band("UT1"), shape.lighter ? 2 : 3, Math.min(8 + 2 * k, 15), 3, d.minutes, shape.lighter));
        } else if (phase === "build") {
          add(d.day, intervalCard(ctx, week, d.day, "quality", band("AT"), shape.lighter ? 3 : 4, Math.min(5 + k, 10), sport === "row" ? 3 : 2, d.minutes, shape.lighter));
        } else if (phase === "specific") {
          // Event pace steps from today's predicted pace towards the goal pace.
          const share = (k + 1) / Math.max(1, shape.countInPhase);
          let pace = predictedSplit + (eventSplit - predictedSplit) * share;
          if (pace < sessionCap) {
            pace = sessionCap;
            capped = true;
          }
          add(d.day, intervalCard(ctx, week, d.day, "quality", eventBand(sport, pace), shape.lighter ? 2 : 3, Math.min(12 + 3 * k, 20), 3, d.minutes, shape.lighter));
        } else {
          add(d.day, intervalCard(ctx, week, d.day, "quality", eventBand(sport, eventSplit), 3, 6, 3, d.minutes, false));
        }
      } else if (speedDay && d.day === speedDay.day && (phase === "build" || phase === "specific") && !shape.lighter) {
        add(d.day, intervalCard(ctx, week, d.day, "speed", band("TR"), 6 + Math.min(shape.indexInPhase, 2), 2, 2, d.minutes, false));
      } else {
        const base = shape.longMinutes > 0 ? shape.longMinutes : longStart;
        const minutes = Math.min(Math.max(20, round5(base * (phase === "taper" ? 0.5 : 0.55))), cap);
        add(d.day, steadyCard(ctx, week, d.day, "steady", band("UT2"), minutes, shape.lighter));
      }
    }

    const strengthPhase: StrengthPhase = phase === "base" ? "foundation" : phase === "build" ? "build" : "power";
    const limit = phase === "taper" ? 1 : 3;
    for (const d of sDays.slice(0, limit)) {
      if (week === 1 && d < startWeekday) continue;
      strength.push({ week, day: d, phase: strengthPhase });
    }
  }

  const phaseNames: Record<Phase, string> = { base: "Base", build: "Build", specific: "Event specific", taper: "Taper", event: "Event week" };
  const weekLabels: Record<number, string> = {};
  const phases: RowingPlanSummary["phases"] = [];
  for (const s of shapes) {
    const name = phaseNames[s.phase];
    const last = phases[phases.length - 1];
    if (last && last.name === name) last.toWeek = s.week;
    else phases.push({ name, fromWeek: s.week, toWeek: s.week });
    const extra = s.test ? ", with a retest" : s.lighter ? ", a lighter week" : "";
    weekLabels[s.week] = s.phase === "event" || s.countInPhase === 1 ? name : `${name} ${s.indexInPhase + 1}${extra}`;
  }

  const baseRef = baselineReference(inputs);
  const testLine =
    sport === "row"
      ? `your 20 minute test of ${metres(inputs.testDistanceM)}, an average of ${formatSplit(baseRef)} per 500m`
      : `your ${metres(inputs.testDistanceM)} in ${formatDuration(Number(inputs.testTimeSeconds))}, which puts your 5K pace at about ${formatSplit(baseRef)} per km`;
  const goalPace = hasGoal ? (Number(inputs.goalTimeSeconds) * text.unitMetres) / (eventDistance as number) : null;
  const goalLine =
    goalPace == null
      ? ""
      : goal?.verdict === "not_yet" && targetSeconds != null
        ? ` You are aiming for ${formatDuration(Number(inputs.goalTimeSeconds))}, which is ${formatSplit(goalPace)} ${text.unit}. The plan starts by building towards ${formatDuration(targetSeconds)}, and moves on as your retests show the fitness is there.`
        : ` You are aiming for ${formatDuration(Number(inputs.goalTimeSeconds))}, which is ${formatSplit(goalPace)} ${text.unit}, and the event pace sessions step from where you are now towards that pace week by week.`;
  const intro =
    `This plan builds you towards the ${eventWord} on ${niceDate(inputs.eventDate)}. Every pace in it comes from ${testLine}, so the numbers are yours rather than anyone else's.${goalLine} ` +
    `The weeks start with easy, steady ${sport === "row" ? "rowing" : "running"} that builds the engine, add harder sessions as the base grows, then sharpen towards event pace before easing off so you arrive fresh. ` +
    `A retest every couple of months shows how far you have come, and Dr David Silver PhD adjusts the paces from what your sessions actually show.`;

  const rules = {
    move_on: `Paces move when your ${text.noun}s show they should, either a retest or several steady ${text.noun}s sitting comfortably quicker than their range. Dr David Silver PhD checks each change before it reaches you, and the plan updates from that week on.`,
    flare: `If something flares, keep to easy ${sport === "row" ? "steady rowing" : "running or walking"} for a few days and tell Dr David Silver PhD what you noticed. We hold the week rather than push through it; that is information, and here is what we do while it settles.`,
  };

  if (capped) {
    flags.push(
      `Event pace sessions are held at ${formatSplit(sessionCap)} ${text.unit}, the edge of today's fast zone, rather than the full ${formatSplit(eventSplit)} ${text.unit}. Once a retest shows the fitness is there, approving it moves them on.`
    );
  }
  if (sDays.length > 2) flags.push(`${sDays.length} strength days are marked. Two a week is usually plenty alongside this much ${sport === "row" ? "rowing" : "running"}.`);

  return {
    ok: true,
    mondayStart,
    title: `${eventWord} ${sport === "row" ? "rowing" : "running"} plan`,
    intro,
    rules,
    weekLabels,
    cards,
    strength,
    flags,
    summary: {
      sport,
      referenceSplit: reference,
      eventMinutes,
      eventSplit,
      predictedSplit,
      predictedSeconds,
      eventDistanceM: eventDistance,
      goal,
      totalWeeks,
      eventWeekday,
      longStart,
      longPeak,
      longTarget,
      status,
      slackWeeks,
      testWeeks: shapes.filter((s) => s.test).map((s) => s.week),
      phases,
    },
  };
}

// ---- Card text ---------------------------------------------------------

type CardCtx = { sport: Sport; eventWord: string; reference: number; refDistance: number; inputs: RowingInputs };

function deviceLine(ctx: CardCtx, row: string, run: string): string {
  if (ctx.sport === "row") return `${row} If you row with the ErgData app connected, the row goes to your Concept2 Logbook and on to Dr David Silver PhD by itself.`;
  return `${run} Afterwards, mark it complete and tell Dr David Silver PhD how it went.`;
}

function target(ctx: CardCtx, b: ZoneBand): string {
  const rate = ZONE_INFO[ctx.sport][b.zone].rate;
  return `${bandText(ctx.sport, b)}${rate ? `, rate ${rate}` : ""}`;
}

function warmUp(ctx: CardCtx, build: boolean): string {
  if (ctx.sport === "row") return build ? "5 min easy, with the last minute building towards the pace of the pieces." : "5 min easy, building gradually to your steady rhythm.";
  return build ? "5 min brisk walk or very easy jog, then a few relaxed strides." : "5 min brisk walk or very easy jog.";
}

function coolDown(ctx: CardCtx): string {
  return ctx.sport === "row" ? "5 min very easy, then a few minutes of gentle movement off the erg." : "5 min easy jog or walk, then a few minutes of gentle movement.";
}

function steadyCard(ctx: CardCtx, week: number, day: number, role: "long" | "steady", b: ZoneBand, minutes: number, lighter: boolean): RowingPlanCard {
  const { sport } = ctx;
  const info = ZONE_INFO[sport][b.zone];
  const noun = SPORT_TEXT[sport].noun;
  const why =
    role === "long"
      ? `The cornerstone of the week, building the aerobic engine you will lean on for every kilometre of the ${ctx.eventWord}.`
      : "Easy, unhurried volume that adds to your aerobic base without taking anything away from the harder days.";
  const longTitle = sport === "row" ? `Long steady row, ${minutes} min` : `Long easy run, ${minutes} min`;
  const easyTitle = sport === "row" ? `Easy steady row, ${minutes} min` : `Easy run, ${minutes} min`;
  return {
    type: sport,
    title: role === "long" ? longTitle : easyTitle,
    summary: lighter ? `${why} This is a lighter week, so the body can absorb the work of the last three.` : why,
    steps: [
      { label: "Warm up", detail: warmUp(ctx, false) },
      { label: `Main ${noun}`, detail: `${minutes} min continuous at ${target(ctx, b)}. ${info.feel}` },
      { label: "Cool down", detail: coolDown(ctx) },
    ],
    target: target(ctx, b),
    total: `${minutes + WARM_COOL_MINUTES} min`,
    notes: deviceLine(ctx, `On the PM5 choose New Workout, then Single Time, and set ${minutes}:00.`, "Run by time rather than distance, and let the pace sit at the slow end of the range if the day calls for it."),
    rowing: { key: `w${week}-d${day}-${role}`, role, zone: b.zone, workSeconds: minutes * 60, pieces: 1, pieceSeconds: minutes * 60, restSeconds: 0, fast: b.fast, slow: b.slow },
  };
}

function intervalCard(
  ctx: CardCtx,
  week: number,
  day: number,
  role: "quality" | "speed" | "primer",
  b: ZoneBand,
  repsWanted: number,
  pieceWanted: number,
  restMinutes: number,
  dayMinutes: number,
  lighter: boolean
): RowingPlanCard {
  const { sport } = ctx;
  const cap = dayMinutes - WARM_COOL_MINUTES;
  let reps = repsWanted;
  let piece = pieceWanted;
  const fits = () => reps * piece + (reps - 1) * restMinutes <= cap;
  while (!fits() && reps > 2) reps -= 1;
  while (!fits() && piece > 3) piece -= 1;
  const info = ZONE_INFO[sport][b.zone];
  const zoneWhy: Record<ZoneId, string> = {
    UT2: "",
    UT1: "Steady pieces that lift the pace you can hold comfortably, which is most of what an endurance event asks of you.",
    AT: "Threshold pieces that raise the ceiling, so your event pace sits further below your limit.",
    TR: "Short fast pieces that sharpen the top end and make every slower pace feel more economical.",
    EVENT: `Pieces at the rhythm you are building towards for the ${ctx.eventWord}, so it becomes familiar long before the day.`,
  };
  const why = role === "primer" ? "A short reminder of event rhythm, enough to feel sharp without adding any fatigue." : zoneWhy[b.zone];
  const restText = sport === "row" ? `${restMinutes} min easy rowing` : `${restMinutes} min easy jog or walk`;
  return {
    type: sport,
    title: `${reps} x ${piece} min ${info.name.toLowerCase()}`,
    summary: lighter ? `${why} One fewer piece this week while the body absorbs the work.` : why,
    steps: [
      { label: "Warm up", detail: warmUp(ctx, true) },
      { label: "Main set", detail: `${reps} x ${piece} min at ${target(ctx, b)}, with ${restText} between. ${info.feel}` },
      { label: "Cool down", detail: coolDown(ctx) },
    ],
    target: target(ctx, b),
    total: `${reps * piece + (reps - 1) * restMinutes + WARM_COOL_MINUTES} min`,
    notes: deviceLine(
      ctx,
      `On the PM5 choose New Workout, then Intervals: Time, and set ${piece}:00 work, ${restMinutes}:00 rest, ${reps} intervals. Keep rowing gently through the rest.`,
      "A flat route or a track keeps the pace honest; on a treadmill, set it to the middle of the range."
    ),
    rowing: { key: `w${week}-d${day}-${role}`, role, zone: b.zone, workSeconds: reps * piece * 60, pieces: reps, pieceSeconds: piece * 60, restSeconds: restMinutes * 60, fast: b.fast, slow: b.slow },
  };
}

function testCard(ctx: CardCtx, week: number, day: number): RowingPlanCard {
  const { sport, inputs, reference } = ctx;
  if (sport === "row") {
    return {
      type: "row",
      title: "20 minute test",
      summary: "A retest, so the plan's paces keep up with you and you can see how far you have come since your first test.",
      steps: [
        { label: "Warm up", detail: "10 min easy, with three 20 second pushes at around test pace and easy rowing between." },
        { label: "The test", detail: `20 min as far as you can, evenly paced. Start around ${formatSplit(reference)} per 500m and only push on in the last five minutes if it feels right.` },
        { label: "Cool down", detail: "5 to 10 min very easy." },
      ],
      target: `Start around ${formatSplit(reference)} /500m`,
      total: "35 to 40 min",
      notes: deviceLine(ctx, "On the PM5 choose New Workout, then Single Time, and set 20:00.", ""),
      rowing: { key: `w${week}-d${day}-test`, role: "test", zone: "AT", workSeconds: 1200, pieces: 1, pieceSeconds: 1200, restSeconds: 0, fast: reference, slow: reference },
    };
  }
  const d = inputs.testDistanceM;
  const pace = predictedPace("run", reference, 5000, d);
  return {
    type: "run",
    title: `Time trial: ${metres(d)}`,
    summary: "A retest over the same distance as your first, so the plan's paces keep up with you and you can see how far you have come.",
    steps: [
      { label: "Warm up", detail: "10 min easy jogging, then three relaxed strides." },
      { label: "The time trial", detail: `${metres(d)} as quick as you can hold evenly. Start around ${formatSplit(pace)} per km and only push on in the last third if it feels right.` },
      { label: "Cool down", detail: "10 min easy jog or walk." },
    ],
    target: `Start around ${formatSplit(pace)} /km`,
    total: `about ${Math.round(timeFromPace("run", pace, d) / 60) + 20} min`,
    notes: "A parkrun, a track or a measured flat route all work. Leave a voice note or a message with your time and Dr David Silver PhD will update your paces.",
    rowing: { key: `w${week}-d${day}-test`, role: "test", zone: "AT", workSeconds: Math.round(timeFromPace("run", pace, d)), pieces: 1, pieceSeconds: Math.round(timeFromPace("run", pace, d)), restSeconds: 0, fast: pace, slow: pace },
  };
}

function eventCard(ctx: CardCtx, week: number, day: number, b: ZoneBand, eventMinutes: number, distance: number | null, hasGoal: boolean): RowingPlanCard {
  const { sport } = ctx;
  const unit = SPORT_TEXT[sport].unitMetres;
  const main = distance != null ? `${metres(distance)} at ${bandText(sport, b)}` : `${Math.round(eventMinutes)} min at ${bandText(sport, b)}`;
  const mid = (b.fast + b.slow) / 2;
  const projected = distance != null ? ` At the middle of that range it comes out at about ${formatDuration((distance * mid) / unit)}.` : "";
  const aim = hasGoal ? " This is your goal pace." : "";
  return {
    type: sport,
    title: `Event day: ${ctx.eventWord}`,
    summary: `The day the plan has been building towards. Start at the slower end of your range and let the pace come to you in the second half.${aim}${projected}`,
    steps: [
      { label: "Warm up", detail: sport === "row" ? "10 min easy, with three 30 second pushes at event pace and easy rowing between." : "10 min easy jogging and a few strides, finishing close to the start." },
      { label: "The event", detail: `${main}${ZONE_INFO[sport].EVENT.rate ? `, rate ${ZONE_INFO[sport].EVENT.rate}` : ""}. Settle in for the first 10 minutes before you judge how it feels.` },
      { label: "Afterwards", detail: `Easy ${sport === "row" ? "rowing" : "jogging"} or walking for 10 minutes, then food and fluids.` },
    ],
    target: target(ctx, b),
    total: distance != null ? `about ${formatDuration(eventMinutes * 60)}` : `${Math.round(eventMinutes)} min`,
    notes: sport === "row" ? (distance != null ? "Set the PM5 to Single Distance for the event distance." : "Set the PM5 to Single Time for the length of the event.") : "Check your watch is charged the night before.",
    rowing: { key: `w${week}-d${day}-event`, role: "event", zone: "EVENT", workSeconds: Math.round(eventMinutes * 60), pieces: 1, pieceSeconds: Math.round(eventMinutes * 60), restSeconds: 0, fast: b.fast, slow: b.slow },
  };
}
