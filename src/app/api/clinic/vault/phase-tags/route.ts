import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Same draft-list-grows-over-time pattern as equipment
// (api/clinic/vault/equipment/route.ts) -- a new phase becomes immediately
// selectable everywhere else since every picker reads this same table live.
export async function POST(request: NextRequest) {
  const body = (await request.json()) as { name?: string };
  const name = body.name;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin.from("phase_tags").insert({ name: name.trim() }).select("id").single<{ id: string }>();
    if (error) throw new Error(error.message);
    return NextResponse.json({ id: data.id });
  } catch (err) {
    console.error("create phase tag failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Create failed: ${detail}` }, { status: 500 });
  }
}
