import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { repeatProgrammeWeek } from "@/lib/programmeCards";

// "Repeat this week" and the flare box, for a programme that has saved
// rules. Only offered when the programme has them, and checked here too.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { programme_id, week_number, kind } = body as {
    programme_id?: string;
    week_number?: number;
    kind?: "repeat_week" | "flare_up";
  };
  if (!programme_id || !Number.isInteger(week_number) || (kind !== "repeat_week" && kind !== "flare_up")) {
    return NextResponse.json({ error: "programme_id, week_number and a valid kind are required." }, { status: 400 });
  }

  const { data: programme } = await supabase
    .from("programmes")
    .select("id, plan_rules")
    .eq("id", programme_id)
    .eq("patient_id", user.id)
    .maybeSingle<{ id: string; plan_rules: unknown }>();
  if (!programme || !programme.plan_rules) return NextResponse.json({ error: "Programme not found." }, { status: 404 });

  try {
    await repeatProgrammeWeek(programme_id, user.id, week_number as number, kind);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
