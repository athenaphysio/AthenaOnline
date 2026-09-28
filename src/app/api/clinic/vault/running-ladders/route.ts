import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// A new ladder starts bare (no rungs) -- same "+ New block" pattern
// elsewhere: create with just a name, then fill in rungs afterward on its
// own edit page.
export async function POST(request: NextRequest) {
  const body = (await request.json()) as { name?: string; phase_label?: string | null };
  const name = body.name;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("running_ladders")
      .insert({ name: name.trim(), phase_label: body.phase_label?.trim() || null })
      .select("id")
      .single<{ id: string }>();
    if (error) throw new Error(error.message);
    return NextResponse.json({ id: data.id });
  } catch (err) {
    console.error("create running ladder failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Create failed: ${detail}` }, { status: 500 });
  }
}
