import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanDesignations } from "@/lib/designations";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const designation = request.nextUrl.searchParams.get("designation")?.trim() ?? "";

  let query = supabaseAdmin.from("workouts").select("id, name, high_load, designations").order("name").limit(30);
  if (q) query = query.ilike("name", `%${q}%`);
  if (designation) query = query.contains("designations", [designation]);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const workouts = (data ?? []).map((w) => ({ ...w, designations: cleanDesignations(w.designations) }));

  return NextResponse.json({ workouts });
}
