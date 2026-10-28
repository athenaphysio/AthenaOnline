import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Used by the client picker. Every word typed has to match the first name,
// surname or email, so "sarah jones" finds Sarah Jones.
export async function GET(request: NextRequest) {
  // Commas, brackets and the like would break the database filter, so only
  // letters, numbers and the characters found in names and emails are kept.
  const words = (request.nextUrl.searchParams.get("q") ?? "")
    .replace(/[^\p{L}\p{N}@.'\-\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);

  let query = supabaseAdmin.from("patients").select("id, first_name, last_name, email");

  if (words.length > 0) {
    for (const word of words) {
      query = query.or(`first_name.ilike.%${word}%,last_name.ilike.%${word}%,email.ilike.%${word}%`);
    }
    query = query.order("first_name").limit(20);
  } else {
    query = query.order("created_at", { ascending: false }).limit(20);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ patients: data ?? [] });
}
