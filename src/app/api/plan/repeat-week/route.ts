import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { repeatPlanWeek } from "@/lib/planActions";

// "Repeat this week" -- from the week view's own button, or from the
// flare button's confirm step (kind tells the two apart in the clinic's
// activity view and David's copy-log).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { imported_plan_id, week_number, kind } = body as {
    imported_plan_id?: string;
    week_number?: number;
    kind?: "repeat_week" | "flare_up";
  };
  if (!imported_plan_id || typeof week_number !== "number" || (kind !== "repeat_week" && kind !== "flare_up")) {
    return NextResponse.json({ error: "imported_plan_id, week_number and a valid kind are required." }, { status: 400 });
  }

  const { data: plan } = await supabase
    .from("imported_plans")
    .select("id")
    .eq("id", imported_plan_id)
    .eq("patient_id", user.id)
    .maybeSingle<{ id: string }>();
  if (!plan) return NextResponse.json({ error: "Plan not found." }, { status: 404 });

  try {
    await repeatPlanWeek(imported_plan_id, user.id, week_number, kind);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: detail }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
