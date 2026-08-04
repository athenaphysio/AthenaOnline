import { NextRequest, NextResponse } from "next/server";
import { getCoach } from "@/lib/coachAuth";
import { createClient } from "@/lib/supabase/server";

// Mirrors /api/clinic/workouts/search/route.ts, but on the coach's own
// client -- readable because of the "any coach" select policy added in
// 0017_coach_template_editing.sql, not because this route trusts the caller.
export async function GET(request: NextRequest) {
  const coach = await getCoach();
  if (!coach) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const supabase = await createClient();

  let query = supabase.from("workouts").select("id, name").order("name").limit(30);
  if (q) query = query.ilike("name", `%${q}%`);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workouts: data ?? [] });
}
