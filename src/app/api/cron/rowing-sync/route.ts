import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { refreshRowing } from "@/lib/rowing/rowingServer";

// Daily: pulls new Concept2 rows for every client on a rowing plan and files
// any suggestions for Dr David Silver PhD. Nothing changes a plan here.
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // rowing_plans has no foreign key to programmes (see 0116), so the two
  // lookups are joined here rather than in the query.
  const { data: plans } = await supabaseAdmin.from("rowing_plans").select("programme_id").returns<{ programme_id: string }[]>();
  const ids = (plans ?? []).map((p) => p.programme_id);
  const { data: live } = ids.length
    ? await supabaseAdmin.from("programmes").select("id").in("id", ids).is("access_paused_at", null).returns<{ id: string }[]>()
    : { data: [] as { id: string }[] };
  let checked = 0;
  let suggestions = 0;
  for (const p of live ?? []) {
    try {
      const out = await refreshRowing(p.id);
      checked += 1;
      suggestions += out.suggestions;
    } catch {
      // One client's problem never stops the rest.
    }
  }
  return NextResponse.json({ checked, suggestions });
}
