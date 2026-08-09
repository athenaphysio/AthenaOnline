// Pure computations over a patient's message thread, shared by the global
// inbox's summary numbers and its per-row state. Same "I/O-free, thresholds
// stated plainly" spirit as patientEngagement.ts.

export type InboxMessage = {
  id: string;
  patient_id: string;
  sender: "patient" | "clinician";
  body: string;
  created_at: string;
  read_at: string | null;
};

const HOUR_MS = 60 * 60 * 1000;

// Whether the most recent message in this thread is from the patient, with
// no clinician reply after it yet, and how many hours it's been waiting --
// the "Awaiting your reply" signal.
export function awaitingReplyHours(threadAscending: InboxMessage[]): number | null {
  if (threadAscending.length === 0) return null;
  const last = threadAscending[threadAscending.length - 1];
  if (last.sender !== "patient") return null;
  return (Date.now() - new Date(last.created_at).getTime()) / HOUR_MS;
}

// Every (patient message -> next clinician message after it) pair in this
// thread -- each is one "reply", the time between them is that reply's
// turnaround. A patient message with no clinician reply yet contributes no
// pair (it's still open, not a reply time of zero or infinity).
export function replyGapsHours(threadAscending: InboxMessage[]): { clinicianRepliedAt: string; hours: number }[] {
  const gaps: { clinicianRepliedAt: string; hours: number }[] = [];
  let pendingPatientAt: string | null = null;
  for (const m of threadAscending) {
    if (m.sender === "patient") {
      pendingPatientAt = m.created_at;
    } else if (pendingPatientAt) {
      const hours = (new Date(m.created_at).getTime() - new Date(pendingPatientAt).getTime()) / HOUR_MS;
      gaps.push({ clinicianRepliedAt: m.created_at, hours });
      pendingPatientAt = null;
    }
  }
  return gaps;
}

export function averageReplyHoursSince(allGaps: { clinicianRepliedAt: string; hours: number }[], since: Date, until?: Date): number | null {
  const inWindow = allGaps.filter((g) => {
    const at = new Date(g.clinicianRepliedAt);
    return at >= since && (!until || at < until);
  });
  if (inWindow.length === 0) return null;
  return inWindow.reduce((sum, g) => sum + g.hours, 0) / inWindow.length;
}
