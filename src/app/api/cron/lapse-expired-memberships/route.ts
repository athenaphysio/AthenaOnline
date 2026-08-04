import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { pauseSubscriptionGatedProgrammesForPatient } from "@/lib/programmeAccess";

type ExpiredMembershipRow = { patient_id: string };

// The one membership-lapse trigger that isn't a Stripe webhook -- a
// prepay's expires_at passing isn't an event Stripe tells us about, it's
// just a date going by, so something has to check for it. Runs daily via
// vercel.json's crons entry. Same end result as the webhook-driven lapses:
// patient_memberships.status -> "lapsed", then every currently active
// programme for that patient gets its access paused, same mechanism as a
// manual unassign (src/lib/programmeAccess.ts).
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data: expired, error: lookupError } = await supabaseAdmin
    .from("patient_memberships")
    .select("patient_id")
    .eq("billing_type", "prepay")
    .eq("status", "active")
    .lt("expires_at", today)
    .returns<ExpiredMembershipRow[]>();

  if (lookupError) {
    console.error("lapse-expired-memberships lookup failed", lookupError.message);
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }

  let lapsedCount = 0;
  for (const row of expired ?? []) {
    const { error: updateError } = await supabaseAdmin
      .from("patient_memberships")
      .update({ status: "lapsed", updated_at: new Date().toISOString() })
      .eq("patient_id", row.patient_id);
    if (updateError) {
      console.error("failed to lapse expired membership", row.patient_id, updateError.message);
      continue;
    }
    try {
      await pauseSubscriptionGatedProgrammesForPatient(row.patient_id);
    } catch (err) {
      console.error("failed to pause programme access for expired prepay", row.patient_id, err);
    }
    lapsedCount += 1;
  }

  return NextResponse.json({ lapsedCount });
}
