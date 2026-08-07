import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Mirrors /api/clinic/blocks/search -- feeds the Cardio tab's picker pane.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const modality = request.nextUrl.searchParams.get("modality")?.trim() ?? "";
  // "steady_state" / "intervals" filter within the general category (Return
  // to Run and Running Progression stay their own groups even though both
  // happen to be interval-shaped); "return_to_run" / "running_progression"
  // filter by category regardless of structure.
  const filter = request.nextUrl.searchParams.get("filter")?.trim() ?? "";

  let query = supabaseAdmin
    .from("cardio_blocks")
    .select("id, name, modality, modality_other, structure, category, entry_criteria, tier")
    .order("name")
    .limit(30);

  if (q) query = query.ilike("name", `%${q}%`);
  if (modality) query = query.eq("modality", modality);
  if (filter === "return_to_run" || filter === "running_progression") {
    query = query.eq("category", filter);
  } else if (filter === "steady_state" || filter === "intervals") {
    query = query.eq("structure", filter).eq("category", "general");
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ cardioBlocks: data ?? [] });
}
