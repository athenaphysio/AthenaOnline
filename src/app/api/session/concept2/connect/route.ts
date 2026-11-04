import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { concept2AuthorizeUrl, concept2Configured } from "@/lib/rowing/concept2";
import { APP_URL } from "@/lib/appUrl";

// Sends the client to Concept2's own sign in page. This app never sees
// their Concept2 password.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${APP_URL}/start`);
  if (!concept2Configured()) return NextResponse.redirect(`${APP_URL}/session/concept2?error=not_ready`);

  const state = randomBytes(24).toString("hex");
  await supabaseAdmin.from("concept2_oauth_states").delete().eq("patient_id", user.id);
  const { error } = await supabaseAdmin.from("concept2_oauth_states").insert({ state, patient_id: user.id });
  if (error) return NextResponse.redirect(`${APP_URL}/session/concept2?error=start`);
  return NextResponse.redirect(concept2AuthorizeUrl(state));
}
