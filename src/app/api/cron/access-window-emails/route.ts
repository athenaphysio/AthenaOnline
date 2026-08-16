import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getPatientMembership, isActiveMembership } from "@/lib/membership";
import { sendAccessWindowWarningEmail, sendAccessWindowClosedEmail, sendAccessWindowFollowupEmail } from "@/lib/email";

// Confirmed with David: 3 days after closure. One follow-up only, never
// a repeating sequence.
const FOLLOWUP_DAYS_AFTER_CLOSURE = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

type CandidateRow = {
  id: string;
  patient_id: string;
  start_date: string;
  access_window_weeks: number;
  access_warning_sent_at: string | null;
  access_closed_email_sent_at: string | null;
  access_followup_sent_at: string | null;
  patients: { email: string; first_name: string } | null;
};

function daysUntil(date: Date, from: Date): number {
  return Math.floor((date.getTime() - from.getTime()) / DAY_MS);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

async function countCompletedSessions(programmeId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("session_completions")
    .select("id", { count: "exact", head: true })
    .eq("programme_id", programmeId)
    .eq("status", "completed");
  return count ?? 0;
}

// Runs daily via vercel.json's crons entry -- see
// lapse-expired-memberships/route.ts for the identical auth pattern this
// mirrors. The one place all three access-window emails (Phase 5 of the
// brief) actually get sent from; nothing else in the app calls these.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // A null access_window_weeks (every existing patient, per Phase 2) or a
  // programme whose access is already paused for some other reason both
  // fall straight out of this query -- there's nothing to warn about or
  // close for either.
  const { data: candidates, error } = await supabaseAdmin
    .from("programmes")
    .select(
      "id, patient_id, start_date, access_window_weeks, access_warning_sent_at, access_closed_email_sent_at, access_followup_sent_at, patients(email, first_name)"
    )
    .not("access_window_weeks", "is", null)
    .is("access_paused_at", null)
    .returns<CandidateRow[]>();

  if (error) {
    console.error("access-window-emails lookup failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let warningsSent = 0;
  let closedSent = 0;
  let followupsSent = 0;

  for (const row of candidates ?? []) {
    const email = row.patients?.email;
    const firstName = row.patients?.first_name;
    if (!email || !firstName) continue;

    const closureDate = new Date(new Date(row.start_date).getTime() + row.access_window_weeks * 7 * DAY_MS);
    const daysToClosure = daysUntil(closureDate, now);

    // Checked live, per patient, every run -- an active membership at
    // this exact moment excludes them from all three emails, not just
    // whichever one would otherwise fire today. Never inferred from
    // anything stored on the programme itself.
    const membership = await getPatientMembership(row.patient_id);
    if (isActiveMembership(membership)) continue;

    try {
      if (!row.access_warning_sent_at && daysToClosure >= 1 && daysToClosure <= 7) {
        const sessionsCompleted = await countCompletedSessions(row.id);
        await sendAccessWindowWarningEmail(row.patient_id, email, firstName, formatDate(closureDate), sessionsCompleted);
        await supabaseAdmin.from("programmes").update({ access_warning_sent_at: now.toISOString() }).eq("id", row.id);
        warningsSent += 1;
      }

      if (!row.access_closed_email_sent_at && daysToClosure <= 0) {
        const sessionsCompleted = await countCompletedSessions(row.id);
        await sendAccessWindowClosedEmail(row.patient_id, email, firstName, sessionsCompleted);
        await supabaseAdmin.from("programmes").update({ access_closed_email_sent_at: now.toISOString() }).eq("id", row.id);
        closedSent += 1;
      }

      if (!row.access_followup_sent_at && (row.access_closed_email_sent_at || daysToClosure <= 0) && daysToClosure <= -FOLLOWUP_DAYS_AFTER_CLOSURE) {
        await sendAccessWindowFollowupEmail(row.patient_id, email, firstName);
        await supabaseAdmin.from("programmes").update({ access_followup_sent_at: now.toISOString() }).eq("id", row.id);
        followupsSent += 1;
      }
    } catch (err) {
      console.error("access-window email failed for programme", row.id, err);
    }
  }

  return NextResponse.json({ warningsSent, closedSent, followupsSent });
}
