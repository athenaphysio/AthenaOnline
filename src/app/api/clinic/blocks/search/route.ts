import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const type = request.nextUrl.searchParams.get("type")?.trim() ?? "";

  let query = supabaseAdmin
    .from("blocks")
    .select("id, name, type, block_length_weeks")
    .order("name")
    .limit(30);

  if (q) query = query.ilike("name", `%${q}%`);
  if (type) query = query.eq("type", type);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ blocks: data ?? [] });
}
