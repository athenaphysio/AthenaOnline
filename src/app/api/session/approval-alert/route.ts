import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendSignupAwaitingApprovalEmail } from "@/lib/email";

// Called by the "waiting for approval" screen. Emails David once per
// account (approval_alert_sent_at), so a client who created their own
// account is never left waiting without him knowing.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  // Claim the alert first, so two open tabs cannot send it twice.
  const { data: claimed } = await supabaseAdmin
    .from("patients")
    .update({ approval_alert_sent_at: new Date().toISOString() })
    .eq("id", user.id)
    .eq("awaiting_approval", true)
    .is("approval_alert_sent_at", null)
    .select("first_name, last_name, email")
    .maybeSingle<{ first_name: string | null; last_name: string | null; email: string | null }>();
  if (!claimed) return NextResponse.json({ ok: true, sent: false });

  try {
    const name = [claimed.first_name, claimed.last_name].filter(Boolean).join(" ");
    await sendSignupAwaitingApprovalEmail(name, claimed.email ?? user.email ?? "");
  } catch (err) {
    console.error("sign-up approval alert failed", err);
    // Let it try again on the client's next visit.
    await supabaseAdmin.from("patients").update({ approval_alert_sent_at: null }).eq("id", user.id);
    return NextResponse.json({ ok: false, sent: false });
  }
  return NextResponse.json({ ok: true, sent: true });
}
