import "server-only";

// The adaptive model itself (Phase 4 of claude_code_instructions_goal_based_
// cardio.md / athena_goal_based_cardio_library.md). Pure calculation only --
// no database access here, so the trajectory math can be reasoned about (and
// tested) on its own, separately from where the resulting sessions get
// written.

export const SAFE_WEEKLY_RATE = 0.1; // ~10%/week, the return-to-run protocol's own rule.
export const MAX_COMPRESSED_RATE = 0.18; // never silently exceed ~15-20%, even compressed.
export const TAPER_FRACTION = 0.12; // taper as a fraction of the pre-taper weeks (roughly 8-15%).

export type TrajectoryResult =
  | {
      status: "comfortable";
      weeksNeeded: number;
      taperWeeks: number;
      totalWeeks: number;
      rate: number;
      slackWeeks: number;
    }
  | {
      status: "tight";
      weeksNeeded: number;
      taperWeeks: number;
      totalWeeks: number;
      rate: number;
    }
  | {
      status: "insufficient";
      weeksNeededSafe: number;
      taperWeeksSafe: number;
      totalWeeksSafe: number;
      weeksAvailable: number;
      message: string;
    };

// How many weeks of compounding growth at `rate` it takes to get from
// baseline to terminal. Ceiling, since a partial week still needs the
// following week to actually reach the target.
export function weeksToReach(baseline: number, terminal: number, rate: number): number {
  if (terminal <= baseline) return 0;
  return Math.ceil(Math.log(terminal / baseline) / Math.log(1 + rate));
}

export function taperWeeksFor(weeksNeeded: number): number {
  return Math.max(1, Math.round(weeksNeeded * TAPER_FRACTION));
}

// Step 1-2 of Phase 4: work out whether the patient's real timeline allows
// the safe rate, a compressed-but-capped rate, or isn't enough time at all.
// Never returns a plan that exceeds MAX_COMPRESSED_RATE -- that's the one
// hard line this function won't cross, no matter how tight weeksAvailable is.
export function planTrajectory(baseline: number, terminal: number, weeksAvailable: number): TrajectoryResult {
  const weeksNeededSafe = weeksToReach(baseline, terminal, SAFE_WEEKLY_RATE);
  const taperWeeksSafe = taperWeeksFor(weeksNeededSafe);
  const totalWeeksSafe = weeksNeededSafe + taperWeeksSafe;

  if (weeksAvailable >= totalWeeksSafe) {
    return {
      status: "comfortable",
      weeksNeeded: weeksNeededSafe,
      taperWeeks: taperWeeksSafe,
      totalWeeks: totalWeeksSafe,
      rate: SAFE_WEEKLY_RATE,
      slackWeeks: weeksAvailable - totalWeeksSafe,
    };
  }

  // Tight: find the rate that lands baseline -> terminal in the weeks
  // actually available (after reserving a proportionate taper), capped.
  const taperWeeksTight = Math.max(1, Math.round(weeksAvailable * TAPER_FRACTION));
  const growthWeeks = weeksAvailable - taperWeeksTight;
  if (growthWeeks > 0) {
    const requiredRate = Math.pow(terminal / baseline, 1 / growthWeeks) - 1;
    if (requiredRate <= MAX_COMPRESSED_RATE) {
      return {
        status: "tight",
        weeksNeeded: growthWeeks,
        taperWeeks: taperWeeksTight,
        totalWeeks: weeksAvailable,
        rate: requiredRate,
      };
    }
  }

  return {
    status: "insufficient",
    weeksNeededSafe,
    taperWeeksSafe,
    totalWeeksSafe,
    weeksAvailable,
    message:
      `At a safe progression rate, this patient needs approximately ${totalWeeksSafe} weeks from their current ` +
      `baseline (${weeksNeededSafe} building plus a ${taperWeeksSafe}-week taper); the target date only allows ` +
      `${weeksAvailable} weeks. Consider moving the event date, choosing a shorter-distance goal, or reframing ` +
      `this as "finish, don't race."`,
  };
}

export type DraftDay = {
  weekNumber: number;
  dayOfWeek: number; // 1 = Monday .. 7 = Sunday
  kind: "long_run" | "easy_run" | "pace_run" | "cross_train" | "tune_up_race" | "taper_run" | "race_day" | "rest";
  description: string;
  distanceValue: number | null;
  distanceUnit: "miles" | "km" | "minutes" | null;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// One growth week's long-effort value, `weekIndex` steps in (1-based) from
// baseline at the given rate, capped at terminal (never generate a
// prescribed value past the actual target).
function longEffortAt(baseline: number, rate: number, weekIndex: number, terminal: number): number {
  return Math.min(terminal, baseline * Math.pow(1 + rate, weekIndex));
}

// Half marathon and marathon share the same shape: a growth phase (long
// run climbing toward terminal at the model's own rate, easy runs as a
// fraction of that week's long run, one cross-train day) then a taper
// (long run stepping back down, race on the final day). Day-of-week
// placement and the presence/rough spacing of tune-up races follow the
// real Higdon Novice 1 (half) / Novice 2 (marathon) plans; the actual
// numbers come from the patient's own baseline/terminal, not Higdon's.
function generateRoadRacePlan(opts: {
  baselineMiles: number;
  terminalMiles: number; // peak long run before taper
  raceMiles: number; // 13.1 or 26.2
  weeksNeeded: number;
  taperWeeks: number;
  rate: number;
  slackWeeks: number;
  tuneUps: { atFractionOfGrowth: number; miles: number; label: string }[];
  longRunDay: number; // day_of_week
  paceRunDay: number | null; // marathon only
}): DraftDay[] {
  const { baselineMiles, terminalMiles, raceMiles, weeksNeeded, taperWeeks, rate, slackWeeks, tuneUps, longRunDay, paceRunDay } = opts;
  const days: DraftDay[] = [];
  let week = 1;

  // Slack (comfortable case only): extra easy base-building weeks up
  // front, holding around baseline rather than rushing into the climb.
  for (let i = 0; i < slackWeeks; i++) {
    pushWeek(week, longRunDay, "long_run", `Easy long run, ${round1(baselineMiles)} miles, conversational pace. Extra base-building week, no need to rush the climb yet.`, round1(baselineMiles), "miles");
    pushEasyAndCross(week, baselineMiles * 0.4, longRunDay);
    week++;
  }

  // Growth phase.
  const tuneUpWeeks = new Map<number, { miles: number; label: string }>();
  for (const t of tuneUps) {
    const w = Math.max(1, Math.round(weeksNeeded * t.atFractionOfGrowth));
    tuneUpWeeks.set(w, { miles: t.miles, label: t.label });
  }

  for (let i = 1; i <= weeksNeeded; i++) {
    const longRun = longEffortAt(baselineMiles, rate, i, terminalMiles);
    const tuneUp = tuneUpWeeks.get(i);
    if (tuneUp) {
      pushWeek(
        week,
        longRunDay,
        "tune_up_race",
        `Tune-up race (or equivalent effort), ${tuneUp.label}, ${tuneUp.miles} miles at a hard-but-controlled effort. Optional -- swap for an equivalent-effort training run if no race is available that week.`,
        tuneUp.miles,
        "miles"
      );
    } else {
      pushWeek(week, longRunDay, "long_run", `Long run, ${round1(longRun)} miles, conversational pace throughout.`, round1(longRun), "miles");
    }
    pushEasyAndCross(week, longRun * 0.4, longRunDay, paceRunDay ? { day: paceRunDay, miles: longRun * 0.55 } : undefined);
    week++;
  }

  // Taper: step the long run back down toward a light shakeout, race on
  // the final week's long-run day.
  let taperLongRun = terminalMiles;
  for (let i = 1; i <= taperWeeks; i++) {
    const isRaceWeek = i === taperWeeks;
    if (isRaceWeek) {
      // Race day itself always lands on Sunday, matching both source
      // plans, even though training long runs otherwise fall on longRunDay.
      pushWeek(week, 7, "race_day", `Race day: ${raceMiles} miles.`, raceMiles, "miles");
      pushWeek(week, 2, "taper_run", "Short shakeout run, 2 miles, easy.", 2, "miles");
    } else {
      taperLongRun = round1(taperLongRun * 0.6);
      pushWeek(week, longRunDay, "taper_run", `Taper long run, ${taperLongRun} miles, easy effort.`, taperLongRun, "miles");
      pushEasyAndCross(week, taperLongRun * 0.4, longRunDay);
    }
    week++;
  }

  function pushWeek(
    w: number,
    day: number,
    kind: DraftDay["kind"],
    description: string,
    value: number | null,
    unit: DraftDay["distanceUnit"]
  ) {
    days.push({ weekNumber: w, dayOfWeek: day, kind, description, distanceValue: value, distanceUnit: unit });
  }

  function pushEasyAndCross(w: number, easyMiles: number, longDay: number, paceRun?: { day: number; miles: number }) {
    const restDays = [1, 5]; // Monday, Friday -- matches both Higdon plans.
    const crossDay = longDay === 6 ? 7 : 6; // Saturday or Sunday, whichever isn't the long-run day.
    for (const d of restDays) pushWeek(w, d, "rest", "Rest day.", null, null);
    // Tue/Wed/Thu always carry a running session -- easy, except Wednesday
    // on the marathon plan, which is a pace run instead.
    for (const d of [2, 3, 4]) {
      if (paceRun && d === paceRun.day) {
        pushWeek(w, d, "pace_run", `Pace run, ${round1(paceRun.miles)} miles at planned race pace.`, round1(paceRun.miles), "miles");
      } else {
        pushWeek(w, d, "easy_run", `Easy run, ${round1(easyMiles)} miles, conversational pace.`, round1(easyMiles), "miles");
      }
    }
    pushWeek(w, crossDay, "cross_train", "Cross-train, 30-45 min easy aerobic activity, your choice.", null, null);
  }

  return days;
}

export function generateHalfMarathonPlan(baselineMiles: number, trajectory: TrajectoryResult): DraftDay[] {
  if (trajectory.status === "insufficient") return [];
  return generateRoadRacePlan({
    baselineMiles,
    terminalMiles: 10,
    raceMiles: 13.1,
    weeksNeeded: trajectory.weeksNeeded,
    taperWeeks: trajectory.taperWeeks,
    rate: trajectory.rate,
    slackWeeks: trajectory.status === "comfortable" ? trajectory.slackWeeks : 0,
    tuneUps: [
      { atFractionOfGrowth: 0.5, miles: 3.1, label: "5K" },
      { atFractionOfGrowth: 0.8, miles: 6.2, label: "10K" },
    ],
    longRunDay: 7,
    paceRunDay: null,
  });
}

export function generateMarathonPlan(baselineMiles: number, trajectory: TrajectoryResult): DraftDay[] {
  if (trajectory.status === "insufficient") return [];
  return generateRoadRacePlan({
    baselineMiles,
    terminalMiles: 20,
    raceMiles: 26.2,
    weeksNeeded: trajectory.weeksNeeded,
    taperWeeks: trajectory.taperWeeks,
    rate: trajectory.rate,
    slackWeeks: trajectory.status === "comfortable" ? trajectory.slackWeeks : 0,
    tuneUps: [{ atFractionOfGrowth: 0.65, miles: 13.1, label: "Half marathon" }],
    longRunDay: 6,
    paceRunDay: 3,
  });
}

// General return to running (Ongoing, no target date): terminal is "30
// continuous minutes," not a distance -- reuses the same safe-rate model,
// then holds at the terminal for a couple of maintenance weeks rather than
// stopping abruptly. No taper, no race day -- there's no event.
export function generateReturnToRunningPlan(baselineMinutes: number): DraftDay[] {
  const terminal = 30;
  const weeksNeeded = weeksToReach(baselineMinutes, terminal, SAFE_WEEKLY_RATE);
  const days: DraftDay[] = [];
  const runDays = [2, 4, 7]; // Tue/Thu/Sun -- three sessions a week, matching the outdoor jog progression's "every other day" spirit.
  const restDays = [1, 3, 5, 6];

  for (let w = 1; w <= weeksNeeded + 2; w++) {
    const minutes = Math.min(terminal, Math.round(longEffortAt(baselineMinutes, SAFE_WEEKLY_RATE, w, terminal)));
    for (const d of runDays) {
      days.push({
        weekNumber: w,
        dayOfWeek: d,
        kind: "easy_run",
        description: `Run, ${minutes} minutes continuous, easy conversational pace.`,
        distanceValue: minutes,
        distanceUnit: "minutes",
      });
    }
    for (const d of restDays) {
      days.push({ weekNumber: w, dayOfWeek: d, kind: "rest", description: "Rest day.", distanceValue: null, distanceUnit: null });
    }
  }
  return days;
}
