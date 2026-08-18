import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanDesignations } from "@/lib/designations";
import { cleanWorkoutKind } from "@/lib/workoutKind";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const designation = request.nextUrl.searchParams.get("designation")?.trim() ?? "";
  // Omitted means every kind, so the programme calendar can still schedule
  // a cardio workout onto a day alongside the rest.
  const kind = request.nextUrl.searchParams.get("kind")?.trim() ?? "";

  let query = supabaseAdmin.from("workouts").select("id, name, high_load, designations, kind").order("name").limit(30);
  if (q) query = query.ilike("name", `%${q}%`);
  if (designation) query = query.contains("designations", [designation]);
  if (kind) query = query.eq("kind", kind);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const workouts = (data ?? []).map((w) => ({
    ...w,
    designations: cleanDesignations(w.designations),
    kind: cleanWorkoutKind(w.kind),
  }));

  return NextResponse.json({ workouts });
}
