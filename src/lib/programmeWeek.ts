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

// Pure date math only -- deliberately isomorphic (no server-only import)
// so a client component can compute the same answer instantly without a
// round trip. NOT the authoritative access decision on its own: an active
// membership always overrides this regardless of what it returns -- see
// isProgrammeClosed in programmeAccessWindow.ts, the server-side function
// that actually combines this with a real membership check. accessWindowWeeks
// null means no window was ever set -- always open.
export function isWithinAccessWindow(startDate: string, accessWindowWeeks: number | null): boolean {
  if (accessWindowWeeks == null) return true;
  return elapsedWeeks(startDate) < accessWindowWeeks;
}

// ISO weekday: 1 = Monday .. 7 = Sunday (matches how the clinic schedules
// programme_workouts.day_of_week).
export function todayIsoWeekday(): number {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 7 : jsDay;
}

// The real calendar date for one specific session -- no session has a
// stored date anywhere (programme_workouts only carries a repeating
// day_of_week), so this is the only place that date ever comes from.
// week_number/day_of_week are both 1-indexed, matching session_completions
// and programme_workouts.
export function sessionDate(startDate: string, weekNumber: number, dayOfWeek: number): Date {
  const d = new Date(startDate);
  d.setDate(d.getDate() + (weekNumber - 1) * 7 + (dayOfWeek - 1));
  return d;
}
