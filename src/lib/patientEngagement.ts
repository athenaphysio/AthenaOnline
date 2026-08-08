// Pure, I/O-free calculations over a patient's own session_completions and
// programme schedule -- same spirit as patientStatus.ts. Adherence and
// streak are both genuinely computable from what's already stored
// (completed_at timestamps, day_of_week schedule); nothing here is
// invented, though the thresholds/definitions below are a first stated
// plainly guess (adherence = scheduled days actually completed within a
// window; streak = consecutive calendar days with at least one
// completion), same caveat as patientStatus.ts's own thresholds.

function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function isoWeekdayOf(date: Date): number {
  const jsDay = date.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function distinctCompletionDates(completions: { completed_at: string }[]): Set<string> {
  return new Set(completions.map((c) => toDateOnly(c.completed_at)));
}

// Consecutive calendar days with a completion, counting back from today --
// if today has nothing yet, that's treated as "still pending" rather than
// "streak broken", so counting starts from yesterday in that case.
export function computeCurrentStreak(dates: Set<string>): number {
  const today = startOfDay(new Date());
  const cursor = new Date(today);
  if (!dates.has(toDateOnly(cursor.toISOString()))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (dates.has(toDateOnly(cursor.toISOString()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// The longest run of consecutive days anywhere in this patient's history --
// compared against computeCurrentStreak to decide whether "personal best"
// is honest to show.
export function computeLongestStreak(dates: Set<string>): number {
  const sorted = Array.from(dates).sort();
  let longest = 0;
  let current = 0;
  let prev: Date | null = null;
  for (const iso of sorted) {
    const d = new Date(iso);
    if (prev && d.getTime() - prev.getTime() === 24 * 60 * 60 * 1000) {
      current += 1;
    } else {
      current = 1;
    }
    longest = Math.max(longest, current);
    prev = d;
  }
  return longest;
}

export type AdherenceResult = { completed: number; prescribed: number; percent: number };

// "Prescribed" = calendar days in [rangeStart, today] that fall on a
// scheduled day-of-week AND on/after the programme's own start date --
// can't be marked non-adherent for days before the programme existed.
// Returns null when there's nothing to measure against (an Open routine,
// with no day-of-week schedule at all).
export function computeAdherence(params: {
  scheduledDaysOfWeek: number[];
  completionDates: Set<string>;
  programmeStartDate: string;
  rangeStart: Date;
  rangeEnd?: Date;
}): AdherenceResult | null {
  if (params.scheduledDaysOfWeek.length === 0) return null;

  const start = startOfDay(new Date(params.programmeStartDate));
  const rangeEnd = startOfDay(params.rangeEnd ?? new Date());
  const rangeStart = startOfDay(params.rangeStart) > start ? startOfDay(params.rangeStart) : start;
  if (rangeStart > rangeEnd) return { completed: 0, prescribed: 0, percent: 0 };

  let prescribed = 0;
  let completed = 0;
  for (const d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
    if (params.scheduledDaysOfWeek.includes(isoWeekdayOf(d))) {
      prescribed += 1;
      if (params.completionDates.has(toDateOnly(d.toISOString()))) completed += 1;
    }
  }
  if (prescribed === 0) return { completed: 0, prescribed: 0, percent: 0 };
  return { completed, prescribed, percent: Math.round((completed / prescribed) * 100) };
}

export function daysAgo(n: number): Date {
  const d = startOfDay(new Date());
  d.setDate(d.getDate() - n);
  return d;
}

export function mostRecentMonday(): Date {
  const d = startOfDay(new Date());
  const weekday = isoWeekdayOf(d);
  d.setDate(d.getDate() - (weekday - 1));
  return d;
}

// A short, relative label for a past date/time, patient-record-list style
// ("Today", "Yesterday", "3 days ago") -- same thresholds as the existing
// relativeTime helpers on PatientListClient.tsx / patients/[id]/page.tsx,
// kept here too since this is a shared-lib file, not a client component.
export function relativeDayLabel(iso: string | null): string {
  if (!iso) return "Not yet done";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}
