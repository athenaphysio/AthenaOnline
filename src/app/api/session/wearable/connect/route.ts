import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getRookProvider } from "@/lib/rookProviders";
import { getRookAuthorizationUrl } from "@/lib/rook";

type PatientRow = { wearable_tracking_enabled: boolean };

// The toggle is checked here, server-side, every time -- never trusted from
// the client. A patient hitting this with the toggle off gets a plain 403,
// same as the page itself redirecting them away.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { dataSource } = body as { dataSource?: string };
  const provider = dataSource ? getRookProvider(dataSource) : undefined;
  if (!provider) {
    return NextResponse.json({ error: "Unknown device." }, { status: 400 });
  }

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("wearable_tracking_enabled")
    .eq("id", user.id)
    .maybeSingle<PatientRow>();
  if (!patient?.wearable_tracking_enabled) {
    return NextResponse.json({ error: "Wearable tracking isn't switched on for this account." }, { status: 403 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://athena-online-kappa.vercel.app";

  try {
    const url = await getRookAuthorizationUrl(user.id, provider.dataSource, `${appUrl}/session/wearable`);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("rook authorization url failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
