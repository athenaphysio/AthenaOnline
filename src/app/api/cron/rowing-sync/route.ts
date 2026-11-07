import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { refreshRowing } from "@/lib/rowing/rowingServer";
import { syncAllConcept2 } from "@/lib/rowing/concept2";

// Daily: pulls new Concept2 sessions for every connected client, whether or
// not they have a rowing plan, so their training reaches the Programme
// Builder; then files any suggestions for clients on a rowing plan for Dr
// David Silver PhD. Nothing changes a plan here.
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const synced = await syncAllConcept2();
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
  return NextResponse.json({ synced, checked, suggestions });
}
