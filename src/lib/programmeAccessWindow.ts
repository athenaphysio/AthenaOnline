import "server-only";
import { isWithinAccessWindow } from "./programmeWeek";
import { getPatientMembership, isActiveMembership } from "./membership";

// Phase 3 of the "programme closed" brief. The one, authoritative answer
// to "is this patient's programme content closed right now" -- every page
// and every mutating route (today's session, the week view, completing or
// skipping a session) must call this rather than reimplementing the
// formula, the same discipline the message-limit gate already follows.
// Deliberately NOT bypassable from the client: the membership lookup
// always happens here, server-side, on every call -- a client can't
// spoof "I have an active plan" the way it could if this were computed
// from data the client already held.
//
// access_window_weeks IS NOT NULL AND today >= start_date + access_window_weeks
// AND the patient has no active membership tier.
//
// The membership check is checked first in practice below (cheaper to
// reason about, and it's the one that can flip a programme back open at
// any moment -- a patient who subscribes mid-window is never closed
// again from that point on, regardless of the date math).
export async function isProgrammeClosed(
  patientId: string,
  programme: { startDate: string; accessWindowWeeks: number | null }
): Promise<boolean> {
  if (programme.accessWindowWeeks == null) return false;

  const membership = await getPatientMembership(patientId);
  if (isActiveMembership(membership)) return false;

  return !isWithinAccessWindow(programme.startDate, programme.accessWindowWeeks);
}
