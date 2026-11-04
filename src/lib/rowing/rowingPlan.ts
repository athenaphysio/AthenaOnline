import type { PlanCardData } from "@/lib/planToBuilder";
import {
  DEFAULT_ZONE_OFFSETS,
  ZONE_INFO,
  bandText,
  cleanOffsets,
  eventOffsetFor,
  formatDuration,
  formatSplit,
  splitFromTwentyMinutes,
  zoneBand,
  type ZoneId,
  type ZoneOffsets,
} from "@/lib/rowing/zones";

// The Rowing Builder's plan engine. Pure calculation only, no database and
// no AI, so the same inputs always give the same plan; that is what lets a
// pace change later rewrite just the paces on cards already in a client's
// programme (matched by each card's stable key) without moving anything
// Dr David Silver PhD has rearranged by hand.

export type DayMode = "none" | "row" | "strength" | "both";

export type RowingDay = { day: number; mode: DayMode; minutes: number };

export type RowingEventKind = "half_marathon" | "marathon" | "custom_distance" | "custom_time";

export type RowingInputs = {
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
  testDistanceM: number;
  /** YYYY-MM-DD */
  testDate: string;
  /** Longest row the client can do comfortably right now, in minutes. */
  longestRowMinutes: number;
  days: RowingDay[];
  zoneOffsets?: ZoneOffsets;
};

export type RowingRole = "long" | "steady" | "quality" | "speed" | "primer" | "event";

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
  referenceSplit: number;
  eventMinutes: number;
  eventSplit: number;
  totalWeeks: number;
  eventWeekday: number;
  longStart: number;
  longPeak: number;
  longTarget: number;
  status: "comfortable" | "tight" | "short";
  slackWeeks: number;
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

export function eventDistanceFor(inputs: Pick<RowingInputs, "eventKind" | "eventDistanceM">): number | null {
  if (inputs.eventKind === "half_marathon") return 21097;
  if (inputs.eventKind === "marathon") return 42195;
  if (inputs.eventKind === "custom_distance") return inputs.eventDistanceM ?? null;
  return null;
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

function metres(n: number): string {
  return `${Math.round(n).toLocaleString("en-GB")}m`;
}

function circularGap(a: number, b: number): number {
  const g = Math.abs(a - b);
  return Math.min(g, 7 - g);
}

export function validateRowingInputs(inputs: RowingInputs): string[] {
  const errors: string[] = [];
  const start = parseDay(inputs.startDate);
  const event = parseDay(inputs.eventDate);
  if (!start) errors.push("Choose a start date.");
  if (!event) errors.push("Choose the event date.");
  if (!parseDay(inputs.testDate)) errors.push("Add the date of the 20 minute test.");
  if (!inputs.eventName.trim()) errors.push("Give the event a name, for example Half marathon row.");
  if (!Number.isFinite(inputs.testDistanceM) || inputs.testDistanceM < 2500 || inputs.testDistanceM > 7500) {
    errors.push("The 20 minute test distance should be in metres, somewhere between 2,500 and 7,500.");
  }
  if (!Number.isFinite(inputs.longestRowMinutes) || inputs.longestRowMinutes < 0 || inputs.longestRowMinutes > 240) {
    errors.push("The longest comfortable row should be in minutes.");
  }
  if (inputs.eventKind === "custom_distance" && !(Number(inputs.eventDistanceM) >= 1000)) {
    errors.push("Add the event distance in metres.");
  }
  if (inputs.eventKind === "custom_time" && !(Number(inputs.eventMinutes) >= 10)) {
    errors.push("Add how long the event lasts, in minutes.");
  }
  if (start && event) {
    const monday = parseDay(mondayOnOrBefore(inputs.startDate))!;
    const weeks = Math.floor(daysBetween(monday, event) / 7) + 1;
    if (daysBetween(start, event) < 0) errors.push("The event date is before the start date.");
    else if (weeks < MIN_WEEKS) errors.push(`There are only ${weeks} weeks to the event; the builder needs at least ${MIN_WEEKS}.`);
    else if (weeks > MAX_WEEKS) errors.push(`The event is ${weeks} weeks away. Plans go up to ${MAX_WEEKS} weeks, so start this one later.`);
  }
  const rowDays = rowingDays(inputs.days);
  if (rowDays.length < 2) errors.push("Mark at least two days for rowing, each with 30 minutes or more.");
  return errors;
}

type RowDay = { day: number; minutes: number };

function rowingDays(days: RowingDay[]): RowDay[] {
  return days
    .filter((d) => d.mode === "row" || d.mode === "both")
    .map((d) => ({ day: d.day, minutes: d.mode === "both" ? d.minutes - STRENGTH_MINUTES : d.minutes }))
    .filter((d) => d.minutes >= 30)
    .sort((a, b) => a.day - b.day);
}

function strengthDays(days: RowingDay[]): number[] {
  return days.filter((d) => d.mode === "strength" || d.mode === "both").map((d) => d.day).sort((a, b) => a - b);
}

type Phase = "base" | "build" | "specific" | "taper" | "event";

type WeekShape = {
  week: number;
  phase: Phase;
  indexInPhase: number;
  lighter: boolean;
  longMinutes: number;
};

export function eventMinutesFor(inputs: RowingInputs, reference: number): { minutes: number; split: number } {
  const distance = eventDistanceFor(inputs);
  if (distance == null) {
    const minutes = Math.max(10, Number(inputs.eventMinutes) || 60);
    return { minutes, split: reference + eventOffsetFor(minutes) };
  }
  // Two passes: the event pace depends on how long the event lasts.
  let split = reference + 8;
  let minutes = (distance * split) / 500 / 60;
  split = reference + eventOffsetFor(minutes);
  minutes = (distance * split) / 500 / 60;
  return { minutes, split };
}

/**
 * Builds the whole plan. `referenceSplit` defaults to the 20 minute test;
 * a later approved pace change passes its own value so the same plan is
 * rebuilt with new paces and nothing else changes.
 */
export function buildRowingPlan(inputs: RowingInputs, referenceSplit?: number): RowingPlanResult {
  const errors = validateRowingInputs(inputs);
  if (errors.length) return { ok: false, errors };

  const offsets = cleanOffsets(inputs.zoneOffsets ?? DEFAULT_ZONE_OFFSETS);
  const reference = referenceSplit ?? splitFromTwentyMinutes(inputs.testDistanceM);
  const flags: string[] = [];

  const mondayStart = mondayOnOrBefore(inputs.startDate);
  const monday = parseDay(mondayStart)!;
  const eventDate = parseDay(inputs.eventDate)!;
  const eventIndex = daysBetween(monday, eventDate);
  const totalWeeks = Math.floor(eventIndex / 7) + 1;
  const eventWeekday = (eventIndex % 7) + 1;
  const startWeekday = daysBetween(monday, parseDay(inputs.startDate)!) + 1;

  const { minutes: eventMinutes, split: eventSplit } = eventMinutesFor(inputs, reference);
  const eventDistance = eventDistanceFor(inputs);

  // Long row: from what the client can do now towards a peak that is a
  // share of the event, never past two hours in training.
  const longStart = round5(Math.max(20, inputs.longestRowMinutes));
  const longTarget = round5(eventMinutes >= 60 ? Math.min(eventMinutes * 0.75, 120) : Math.max(30, eventMinutes * 1.1));

  const taperWeeks = eventMinutes >= 60 && totalWeeks >= 8 ? 2 : 1;
  const growthWeeks = totalWeeks - taperWeeks;
  const lighterWeeks = new Set<number>();
  for (let w = 4; w < growthWeeks; w += 4) lighterWeeks.add(w);
  const progressingWeeks = growthWeeks - lighterWeeks.size;

  let rate = 0;
  if (longTarget > longStart && progressingWeeks > 1) {
    rate = Math.pow(longTarget / longStart, 1 / (progressingWeeks - 1)) - 1;
  }
  let status: RowingPlanSummary["status"] = "comfortable";
  if (rate > SAFE_RATE) status = "tight";
  if (rate > MAX_RATE) {
    status = "short";
    rate = MAX_RATE;
  }
  let slackWeeks = 0;
  if (status === "comfortable" && longTarget > longStart) {
    const needed = Math.ceil(Math.log(longTarget / longStart) / Math.log(1 + SAFE_RATE)) + 1;
    const neededWithLighter = needed + Math.floor(needed / 3);
    slackWeeks = Math.max(0, growthWeeks - neededWithLighter);
  } else if (status === "comfortable") {
    slackWeeks = Math.max(0, growthWeeks - 4);
  }

  // Phases across the growth weeks.
  const baseWeeks = Math.max(1, Math.round(growthWeeks * 0.4));
  const buildWeeks = Math.max(growthWeeks >= 3 ? 1 : 0, Math.round(growthWeeks * 0.35));
  const shapes: WeekShape[] = [];
  let progressed = 0;
  let lastFull = longStart;
  const phaseCounters: Record<Phase, number> = { base: 0, build: 0, specific: 0, taper: 0, event: 0 };
  for (let w = 1; w <= totalWeeks; w++) {
    let phase: Phase;
    if (w === totalWeeks) phase = "event";
    else if (w > growthWeeks) phase = "taper";
    else if (w <= baseWeeks) phase = "base";
    else if (w <= baseWeeks + buildWeeks) phase = "build";
    else phase = "specific";
    const lighter = lighterWeeks.has(w);
    let longMinutes: number;
    if (phase === "taper") longMinutes = round5(lastFull * 0.65);
    else if (phase === "event") longMinutes = 0;
    else if (lighter) longMinutes = round5(lastFull * 0.8);
    else {
      longMinutes = Math.min(longTarget, longStart * Math.pow(1 + rate, progressed));
      longMinutes = round5(longMinutes);
      lastFull = longMinutes;
      progressed += 1;
    }
    shapes.push({ week: w, phase, indexInPhase: phaseCounters[phase]++, lighter, longMinutes });
  }
  const longPeak = Math.max(...shapes.map((s) => s.longMinutes));
  if (status === "short") {
    flags.push(
      `There isn't quite enough time to build the long row from ${longStart} to ${longTarget} minutes at a safe rate, so it peaks at ${longPeak} minutes. Worth deciding whether that is enough for this event.`
    );
  } else if (status === "tight") {
    flags.push(`The long row has to grow by about ${Math.round(rate * 100)}% a week to reach ${longTarget} minutes, faster than the usual 10%. Watch the first few weeks closely.`);
  }

  const rowDays = rowingDays(inputs.days);
  const longDay = [...rowDays].sort((a, b) => b.minutes - a.minutes || b.day - a.day)[0];
  const others = rowDays.filter((d) => d.day !== longDay.day);
  const qualityDay = [...others].sort(
    (a, b) => circularGap(b.day, longDay.day) - circularGap(a.day, longDay.day) || b.minutes - a.minutes
  )[0];
  const speedCandidates = others.filter((d) => d.day !== qualityDay?.day);
  const speedDay =
    rowDays.length >= 4
      ? [...speedCandidates].sort(
          (a, b) =>
            Math.min(circularGap(b.day, qualityDay.day), circularGap(b.day, longDay.day)) -
            Math.min(circularGap(a.day, qualityDay.day), circularGap(a.day, longDay.day))
        )[0]
      : undefined;

  for (const d of rowDays) {
    if (d.day === longDay.day && d.minutes - WARM_COOL_MINUTES < longPeak) {
      flags.push(
        `${DAY_NAMES[d.day - 1]} has ${d.minutes} minutes, so the long row is held at ${d.minutes - WARM_COOL_MINUTES} minutes rather than reaching ${longPeak}. More time that day would let it grow.`
      );
    }
  }

  const eventWord = inputs.eventName.trim();
  const cards: RowingCard[] = [];
  const strength: StrengthPlacement[] = [];
  const sDays = strengthDays(inputs.days);

  const band = (zone: ZoneId) => zoneBand(reference, zone, offsets, eventMinutes);

  for (const shape of shapes) {
    const { week, phase } = shape;
    let order = 0;
    const add = (day: number, plan: RowingPlanCard) => {
      if (week === 1 && day < startWeekday) return;
      cards.push({ week, day, order: order++, plan });
    };

    if (phase === "event") {
      // Event week: one short primer early, an easy row two days out, the
      // day before off, then the event itself.
      const before = rowDays.filter((d) => d.day < eventWeekday - 1);
      const primerDay = before.find((d) => d.day <= eventWeekday - 3);
      if (primerDay) {
        add(primerDay.day, intervalCard(week, primerDay.day, "primer", band("EVENT"), 3, 5, 2, primerDay.minutes, false, eventWord));
      }
      const easyDay = [...before].reverse().find((d) => d.day !== primerDay?.day && d.day === eventWeekday - 2);
      if (easyDay) add(easyDay.day, steadyCard(week, easyDay.day, "steady", band("UT2"), 20, eventWord, false));
      add(eventWeekday, eventCard(week, eventWeekday, band("EVENT"), eventMinutes, eventDistance, inputs, eventWord));
      for (const d of sDays) {
        if (d <= eventWeekday - 4 && strength.filter((s) => s.week === week).length < 1) strength.push({ week, day: d, phase: "power" });
      }
      continue;
    }

    for (const d of rowDays) {
      const cap = d.minutes - WARM_COOL_MINUTES;
      if (d.day === longDay.day) {
        const minutes = Math.min(shape.longMinutes, cap);
        add(d.day, steadyCard(week, d.day, "long", band("UT2"), minutes, eventWord, shape.lighter));
      } else if (d.day === qualityDay?.day) {
        const k = shape.indexInPhase;
        if (phase === "base") {
          add(d.day, intervalCard(week, d.day, "quality", band("UT1"), shape.lighter ? 2 : 3, Math.min(8 + 2 * k, 15), 3, d.minutes, shape.lighter, eventWord));
        } else if (phase === "build") {
          add(d.day, intervalCard(week, d.day, "quality", band("AT"), shape.lighter ? 3 : 4, Math.min(5 + k, 10), 3, d.minutes, shape.lighter, eventWord));
        } else if (phase === "specific") {
          add(d.day, intervalCard(week, d.day, "quality", band("EVENT"), shape.lighter ? 2 : 3, Math.min(12 + 3 * k, 20), 3, d.minutes, shape.lighter, eventWord));
        } else {
          add(d.day, intervalCard(week, d.day, "quality", band("AT"), 3, 6, 3, d.minutes, false, eventWord));
        }
      } else if (speedDay && d.day === speedDay.day && (phase === "build" || phase === "specific") && !shape.lighter) {
        add(d.day, intervalCard(week, d.day, "speed", band("TR"), 6 + Math.min(shape.indexInPhase, 2), 2, 2, d.minutes, false, eventWord));
      } else {
        const base = shape.longMinutes > 0 ? shape.longMinutes : longStart;
        const minutes = Math.min(Math.max(20, round5(base * (phase === "taper" ? 0.5 : 0.55))), cap);
        add(d.day, steadyCard(week, d.day, "steady", band("UT2"), minutes, eventWord, shape.lighter));
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
    const count = shapes.filter((x) => x.phase === s.phase).length;
    weekLabels[s.week] =
      s.phase === "event" || count === 1 ? name : `${name} ${s.indexInPhase + 1}${s.lighter ? ", a lighter week" : ""}`;
  }

  const testSplit = splitFromTwentyMinutes(inputs.testDistanceM);
  const intro =
    `This plan builds you towards the ${eventWord} on ${niceDate(inputs.eventDate)}. ` +
    `Every pace in it comes from your 20 minute test of ${metres(inputs.testDistanceM)}, an average of ${formatSplit(testSplit)} per 500m, ` +
    `so the numbers are yours rather than anyone else's. The weeks start with easy, steady rowing that builds the engine, add harder pieces as the base grows, ` +
    `then sharpen towards event pace before easing off so you arrive fresh. As your rows come in from the PM5, Dr David Silver PhD reads them and adjusts the paces so the plan keeps pace with you.`;

  const rules = {
    move_on:
      "Paces move when your rows show they should, either a new 20 minute test or several steady rows sitting comfortably quicker than their range. Dr David Silver PhD checks each change before it reaches you, and the plan updates from that week on.",
    flare:
      "If something flares, keep to easy steady rowing for a few days and tell Dr David Silver PhD what you noticed. We hold the week rather than push through it; that is information, and here is what we do while it settles.",
  };

  if (sDays.length > 2) flags.push(`${sDays.length} strength days are marked. Two a week is usually plenty alongside this much rowing.`);

  return {
    ok: true,
    mondayStart,
    title: `${eventWord} rowing plan`,
    intro,
    rules,
    weekLabels,
    cards,
    strength,
    flags,
    summary: {
      referenceSplit: reference,
      eventMinutes,
      eventSplit,
      totalWeeks,
      eventWeekday,
      longStart,
      longPeak,
      longTarget,
      status,
      slackWeeks,
      phases,
    },
  };
}

// ---- Card text ---------------------------------------------------------

function pm5Line(text: string): string {
  return `${text} If you row with the ErgData app connected, the row goes to your Concept2 Logbook and on to Dr David Silver PhD by itself.`;
}

function steadyCard(
  week: number,
  day: number,
  role: "long" | "steady",
  b: ReturnType<typeof zoneBand>,
  minutes: number,
  eventWord: string,
  lighter: boolean
): RowingPlanCard {
  const info = ZONE_INFO[b.zone];
  const why =
    role === "long"
      ? `The cornerstone of the week, building the aerobic engine you will lean on for every kilometre of the ${eventWord}.`
      : "Easy, unhurried volume that adds to your aerobic base without taking anything away from the harder days.";
  return {
    type: "row",
    title: role === "long" ? `Long steady row, ${minutes} min` : `Easy steady row, ${minutes} min`,
    summary: lighter ? `${why} This is a lighter week, so the body can absorb the work of the last three.` : why,
    steps: [
      { label: "Warm up", detail: "5 min easy, building gradually to your steady rhythm." },
      { label: "Main row", detail: `${minutes} min continuous at ${bandText(b)}, rate ${info.rate}. ${info.feel}` },
      { label: "Cool down", detail: "5 min very easy, then a few minutes of gentle movement off the erg." },
    ],
    target: `${bandText(b)}, rate ${info.rate}`,
    total: `${minutes + WARM_COOL_MINUTES} min`,
    notes: pm5Line(`On the PM5 choose New Workout, then Single Time, and set ${minutes}:00.`),
    rowing: {
      key: `w${week}-d${day}-${role}`,
      role,
      zone: b.zone,
      workSeconds: minutes * 60,
      pieces: 1,
      pieceSeconds: minutes * 60,
      restSeconds: 0,
      fast: b.fast,
      slow: b.slow,
    },
  };
}

function intervalCard(
  week: number,
  day: number,
  role: "quality" | "speed" | "primer",
  b: ReturnType<typeof zoneBand>,
  repsWanted: number,
  pieceWanted: number,
  restMinutes: number,
  dayMinutes: number,
  lighter: boolean,
  eventWord: string
): RowingPlanCard {
  const cap = dayMinutes - WARM_COOL_MINUTES;
  let reps = repsWanted;
  let piece = pieceWanted;
  const fits = () => reps * piece + (reps - 1) * restMinutes <= cap;
  while (!fits() && reps > 2) reps -= 1;
  while (!fits() && piece > 3) piece -= 1;
  const info = ZONE_INFO[b.zone];
  const zoneWhy: Record<ZoneId, string> = {
    UT2: "",
    UT1: "Steady pieces that lift the pace you can hold comfortably, which is most of what an endurance event asks of you.",
    AT: "Threshold pieces that raise the ceiling, so your event pace sits further below your limit.",
    TR: "Short fast pieces that sharpen the top end and make every slower pace feel more economical.",
    EVENT: `Pieces at the rhythm you plan to hold in the ${eventWord}, so it becomes familiar long before the day.`,
  };
  const why = role === "primer" ? "A short reminder of event rhythm, enough to feel sharp without adding any fatigue." : zoneWhy[b.zone];
  const restText = `${restMinutes} min easy rowing`;
  return {
    type: "row",
    title: `${reps} x ${piece} min ${info.name.toLowerCase()}`,
    summary: lighter ? `${why} One fewer piece this week while the body absorbs the work.` : why,
    steps: [
      { label: "Warm up", detail: "5 min easy, with the last minute building towards the pace of the pieces." },
      {
        label: "Main set",
        detail: `${reps} x ${piece} min at ${bandText(b)}, rate ${info.rate}, with ${restText} between. ${info.feel}`,
      },
      { label: "Cool down", detail: "5 min very easy." },
    ],
    target: `${bandText(b)}, rate ${info.rate}`,
    total: `${reps * piece + (reps - 1) * restMinutes + WARM_COOL_MINUTES} min`,
    notes: pm5Line(
      `On the PM5 choose New Workout, then Intervals: Time, and set ${piece}:00 work, ${restMinutes}:00 rest, ${reps} intervals. Keep rowing gently through the rest.`
    ),
    rowing: {
      key: `w${week}-d${day}-${role}`,
      role,
      zone: b.zone,
      workSeconds: reps * piece * 60,
      pieces: reps,
      pieceSeconds: piece * 60,
      restSeconds: restMinutes * 60,
      fast: b.fast,
      slow: b.slow,
    },
  };
}

function eventCard(
  week: number,
  day: number,
  b: ReturnType<typeof zoneBand>,
  eventMinutes: number,
  distance: number | null,
  inputs: RowingInputs,
  eventWord: string
): RowingPlanCard {
  const main = distance != null ? `${metres(distance)} at ${bandText(b)}` : `${Math.round(eventMinutes)} min at ${bandText(b)}`;
  const projected = distance != null ? ` At the middle of that range it comes out at about ${formatDuration((distance * ((b.fast + b.slow) / 2)) / 500)}.` : "";
  return {
    type: "row",
    title: `Event day: ${eventWord}`,
    summary: `The day the plan has been building towards. Start at the slower end of your range and let the pace come to you in the second half.${projected}`,
    steps: [
      { label: "Warm up", detail: "10 min easy, with three 30 second pushes at event pace and easy rowing between." },
      { label: "The event", detail: `${main}, rate ${ZONE_INFO.EVENT.rate}. Settle in for the first 10 minutes before you judge how it feels.` },
      { label: "Afterwards", detail: "Easy rowing or walking for 10 minutes, then food and fluids." },
    ],
    target: `${bandText(b)}, rate ${ZONE_INFO.EVENT.rate}`,
    total: distance != null ? `about ${Math.round(eventMinutes)} min` : `${Math.round(eventMinutes)} min`,
    notes: inputs.eventKind === "custom_time" ? "Set the PM5 to Single Time for the length of the event." : "Set the PM5 to Single Distance for the event distance.",
    rowing: {
      key: `w${week}-d${day}-event`,
      role: "event",
      zone: "EVENT",
      workSeconds: Math.round(eventMinutes * 60),
      pieces: 1,
      pieceSeconds: Math.round(eventMinutes * 60),
      restSeconds: 0,
      fast: b.fast,
      slow: b.slow,
    },
  };
}
