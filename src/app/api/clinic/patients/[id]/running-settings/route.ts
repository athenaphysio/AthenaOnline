import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// David's own levers for one client's running progression -- pain limit
// and ask_first/automatic, see 0087_running_progression.sql. Same PATCH-a-
// column pattern as wearable/route.ts.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { pain_limit, progression_mode } = body as {
    pain_limit?: number;
    progression_mode?: "ask_first" | "automatic";
  };

  const update: Record<string, unknown> = {};
  if (pain_limit !== undefined) {
    if (typeof pain_limit !== "number" || pain_limit < 0 || pain_limit > 10) {
      return NextResponse.json({ error: "pain_limit must be between 0 and 10." }, { status: 400 });
    }
    update.running_pain_limit = pain_limit;
  }
  if (progression_mode !== undefined) {
    if (progression_mode !== "ask_first" && progression_mode !== "automatic") {
      return NextResponse.json({ error: "progression_mode must be ask_first or automatic." }, { status: 400 });
    }
    update.running_progression_mode = progression_mode;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("patients").update(update).eq("id", id);
  if (error) {
    console.error("update running settings failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
