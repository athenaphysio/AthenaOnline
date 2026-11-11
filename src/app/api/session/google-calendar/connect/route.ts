import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { googleAuthorizeUrl, googleCalendarConfigured } from "@/lib/googleCalendar";
import { plannerEnabled } from "@/lib/diaryServer";
import { APP_URL } from "@/lib/appUrl";

// Sends the client to Google's own sign in page. This app never sees their
// Google password.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${APP_URL}/start`);
  if (!(await plannerEnabled(user.id))) return NextResponse.redirect(`${APP_URL}/session/me`);
  if (!googleCalendarConfigured()) return NextResponse.redirect(`${APP_URL}/session/diary?error=not_ready`);

  const state = randomBytes(24).toString("hex");
  await supabaseAdmin.from("google_oauth_states").delete().eq("patient_id", user.id);
  const { error } = await supabaseAdmin.from("google_oauth_states").insert({ state, patient_id: user.id });
  if (error) return NextResponse.redirect(`${APP_URL}/session/diary?error=start`);
  return NextResponse.redirect(googleAuthorizeUrl(state));
}
