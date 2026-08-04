import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { SlotType } from "@/lib/slotTypes";

// A simple, fire-and-forget log of what Dr Silver actually picks in the
// Workout Builder, read back by rankLibrary.ts to sharpen ranking order over
// time. Never blocks or fails the pick itself if this write fails.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { pool, item_id, slot_type, context } = body as {
    pool: "exercises" | "blocks";
    item_id: string;
    slot_type?: SlotType;
    context: { focus: string; equipment: string; experienceLevel: string; tags: string[] };
  };

  if ((pool !== "exercises" && pool !== "blocks") || !item_id) {
    return NextResponse.json({ error: "pool and item_id are required." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("picker_selection_history").insert({
    pool,
    item_id,
    slot_type: slot_type ?? null,
    focus: context?.focus || null,
    equipment: context?.equipment || null,
    experience_level: context?.experienceLevel || null,
    tags: context?.tags?.length ? context.tags : null,
  });

  if (error) {
    console.error("record picker selection failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
