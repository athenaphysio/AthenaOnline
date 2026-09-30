import type { AthenaPlanV1, PlanWeek } from "@/lib/athenaPlan";

// Same elapsed-weeks arithmetic as programmeWeek.ts's elapsedWeeks, kept
// separate rather than shared -- a plan's weeks aren't guaranteed
// contiguous 1..N the way a programme's block length is, so "current
// week" here means "the highest week number that's actually started,"
// clamped to what the plan actually has.
export function elapsedPlanWeeks(effectiveStartDate: string): number {
  const elapsedMs = Date.now() - new Date(effectiveStartDate).getTime();
  return Math.floor(elapsedMs / (7 * 24 * 60 * 60 * 1000));
}

// The week actually current right now, by date -- always exists as long
// as the plan has at least one week (Step 2's validator guarantees that).
export function currentPlanWeekNumber(plan: AthenaPlanV1, effectiveStartDate: string): number {
  const weekNumbers = plan.weeks.map((w) => w.week).sort((a, b) => a - b);
  const target = elapsedPlanWeeks(effectiveStartDate) + 1;
  // The latest week number that's <= target, or the first week if the
  // plan hasn't started yet, or the last week if it's run past the end.
  let best = weekNumbers[0];
  for (const n of weekNumbers) {
    if (n <= target) best = n;
  }
  return best;
}

export function findPlanWeek(plan: AthenaPlanV1, weekNumber: number): PlanWeek | null {
  return plan.weeks.find((w) => w.week === weekNumber) ?? null;
}

export function isFirstPlanWeek(plan: AthenaPlanV1, weekNumber: number): boolean {
  const weekNumbers = plan.weeks.map((w) => w.week);
  return weekNumber === Math.min(...weekNumbers);
}

export function adjacentPlanWeek(plan: AthenaPlanV1, weekNumber: number, direction: "prev" | "next"): number | null {
  const weekNumbers = plan.weeks.map((w) => w.week).sort((a, b) => a - b);
  const idx = weekNumbers.indexOf(weekNumber);
  if (idx === -1) return null;
  const targetIdx = direction === "prev" ? idx - 1 : idx + 1;
  return weekNumbers[targetIdx] ?? null;
}
