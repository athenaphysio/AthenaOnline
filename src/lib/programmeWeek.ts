// Shared by the patient-facing /session page and the Coach patient-detail
// page -- both need to know "which week is this programme on" and "what's
// today's ISO weekday."

export function currentWeekNumber(startDate: string, blockLengthWeeks: number): number {
  const week = elapsedWeeks(startDate) + 1;
  return Math.min(Math.max(week, 1), blockLengthWeeks);
}

// Unclamped version of the same calculation -- lets a caller tell "still in
// the final week" apart from "block finished weeks ago," which
// currentWeekNumber's clamping to blockLengthWeeks can't distinguish.
export function elapsedWeeks(startDate: string): number {
  const elapsedMs = Date.now() - new Date(startDate).getTime();
  return Math.floor(elapsedMs / (7 * 24 * 60 * 60 * 1000));
}

// ISO weekday: 1 = Monday .. 7 = Sunday (matches how the clinic schedules
// programme_workouts.day_of_week).
export function todayIsoWeekday(): number {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 7 : jsDay;
}
