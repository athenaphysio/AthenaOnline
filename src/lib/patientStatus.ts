// One place for the rules that turn raw programme/activity data into what
// the clinic dashboard shows per patient. Pure and I/O-free on purpose --
// the thresholds below are a first, stated-plainly guess at what's useful
// to scan down a list; expect to tune them once they're seen live.

import { currentWeekNumber, elapsedWeeks } from "./programmeWeek";

export type PatientStatus = "brand_new" | "no_programme" | "active" | "ending_soon" | "lapsed" | "block_ended";

export type PatientStanding = {
  whatTheyreOn: string;
  cyclePosition: string;
  status: PatientStatus;
};

// The coarse Active/Inactive split used by the dashboard's left rail.
// "Active" means something is currently in flight and either fine or about
// to need renewing. "Inactive" is every state where nothing's currently
// running -- which deliberately groups brand-new signups in with lapsed and
// ended patients, since both are states that could use attention.
export function isActiveStatus(status: PatientStatus): boolean {
  return status === "active" || status === "ending_soon";
}

type ScheduledInput = {
  title: string;
  blockLengthWeeks: number;
  startDate: string;
};

type OpenInput = {
  title: string;
  createdAt: string;
};

const BRAND_NEW_DAYS = 7;
const ACTIVE_WITHIN_DAYS = 10;
const NEW_ROUTINE_GRACE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / DAY_MS;
}

export function computePatientStanding(input: {
  patientCreatedAt: string;
  /** max(last_seen_at, most recent session_completions.occurred_at) */
  lastActivityAt: string | null;
  /** Most recent Scheduled programme, if any. */
  scheduled: ScheduledInput | null;
  /** Most recent Open programme, if any. */
  open: OpenInput | null;
}): PatientStanding {
  const { patientCreatedAt, lastActivityAt, scheduled, open } = input;

  if (!scheduled && !open) {
    return {
      whatTheyreOn: "Nothing yet",
      cyclePosition: "—",
      status: daysSince(patientCreatedAt) <= BRAND_NEW_DAYS ? "brand_new" : "no_programme",
    };
  }

  // Scheduled is shown as the primary line when both exist -- matches how
  // the patient's own /session page already treats Scheduled as primary
  // (src/app/session/page.tsx).
  const suffix = scheduled && open ? " + open routine" : "";

  if (scheduled) {
    const whatTheyreOn = scheduled.title + suffix;
    // currentWeekNumber clamps to blockLengthWeeks, so it can't tell "in
    // the final week" apart from "block finished weeks ago" -- this raw
    // week number can.
    const rawWeekNumber = elapsedWeeks(scheduled.startDate) + 1;
    const displayWeek = currentWeekNumber(scheduled.startDate, scheduled.blockLengthWeeks);
    const cyclePosition = `Week ${displayWeek} of ${scheduled.blockLengthWeeks}`;

    if (rawWeekNumber > scheduled.blockLengthWeeks) {
      return { whatTheyreOn, cyclePosition, status: "block_ended" };
    }
    if (rawWeekNumber === scheduled.blockLengthWeeks) {
      return { whatTheyreOn, cyclePosition, status: "ending_soon" };
    }
    const active = lastActivityAt != null && daysSince(lastActivityAt) <= ACTIVE_WITHIN_DAYS;
    return { whatTheyreOn, cyclePosition, status: active ? "active" : "lapsed" };
  }

  // Open-only -- no natural end, so purely activity-based. A routine with
  // no activity yet gets a short grace period from when it was built,
  // rather than reading as "lapsed" before the patient's had a chance to
  // open it.
  const openInput = open as OpenInput;
  const active =
    (lastActivityAt != null && daysSince(lastActivityAt) <= ACTIVE_WITHIN_DAYS) ||
    (lastActivityAt == null && daysSince(openInput.createdAt) <= NEW_ROUTINE_GRACE_DAYS);
  return {
    whatTheyreOn: openInput.title,
    cyclePosition: "Routine (open)",
    status: active ? "active" : "lapsed",
  };
}
