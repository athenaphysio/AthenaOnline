import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { forgetThisDevice } from "@/lib/coachAuth";

// Logs the clinician out and forgets this device.
export async function POST() {
  await forgetThisDevice();
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
