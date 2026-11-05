import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const TAGS = ["going_well", "neutral", "worth_watching"];

// David's own one tap read of a voice note. Tapping marks the note as read.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ noteId: string }> }) {
  const { noteId } = await params;
  const { tag } = (await request.json()) as { tag?: string | null };
  if (tag !== null && !TAGS.includes(String(tag))) return NextResponse.json({ error: "That tag isn't recognised." }, { status: 400 });
  const { error } = await supabaseAdmin
    .from("voice_notes")
    .update({ clinician_tag: tag, read_at: new Date().toISOString() })
    .eq("id", noteId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
