import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name } = body as { name: string };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Group name is required." }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("patient_groups")
      .insert({ name: name.trim() })
      .select("id, name")
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ id: data.id, name: data.name });
  } catch (err) {
    console.error("create group failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Create failed: ${detail}` }, { status: 500 });
  }
}
