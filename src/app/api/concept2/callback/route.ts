import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { finishConcept2Connect } from "@/lib/rowing/concept2";
import { APP_URL } from "@/lib/appUrl";

// Concept2 sends the client back here after they approve. The state ties
// the reply to the client who started it, so the link can't be hijacked.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const back = (q: string) => NextResponse.redirect(`${APP_URL}/session/concept2?${q}`);
  if (!code || !state) return back("error=declined");

  const { data: row } = await supabaseAdmin
    .from("concept2_oauth_states")
    .select("patient_id, created_at")
    .eq("state", state)
    .maybeSingle<{ patient_id: string; created_at: string }>();
  await supabaseAdmin.from("concept2_oauth_states").delete().eq("state", state);
  if (!row || Date.now() - new Date(row.created_at).getTime() > 30 * 60 * 1000) return back("error=expired");

  try {
    await finishConcept2Connect(row.patient_id, code);
  } catch {
    return back("error=exchange");
  }
  return back("connected=1");
}
