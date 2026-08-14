import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// One-click "I've been through all of these" -- still per-programme, still
// reversible per row from the individual session badges.
export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { error } = await supabaseAdmin.from("programme_cardio_draft_sessions").update({ review_status: "reviewed" }).eq("programme_id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ id });
  } catch (err) {
    console.error("mark all cardio draft sessions reviewed failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Update failed: ${detail}` }, { status: 500 });
  }
}
