import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  let query = supabaseAdmin.from("patients").select("id, first_name, email").order("first_name").limit(20);

  if (q) {
    query = query.or(`first_name.ilike.%${q}%,email.ilike.%${q}%`);
  } else {
    query = supabaseAdmin.from("patients").select("id, first_name, email").order("created_at", { ascending: false }).limit(20);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ patients: data ?? [] });
}
