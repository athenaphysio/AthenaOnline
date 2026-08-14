import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Phase 5: David can edit or remove any single drafted session before (or
// after) approving the rest -- see CardioDraftReview.tsx. Deliberately
// narrow: description/distance/review_status only, no reassigning which
// programme a session belongs to.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const body = (await request.json()) as {
    description?: string;
    distance_value?: number | null;
    distance_unit?: string | null;
    review_status?: "pending" | "reviewed";
  };

  try {
    const update: Record<string, unknown> = {};
    if (body.description !== undefined) update.description = body.description;
    if (body.distance_value !== undefined) update.distance_value = body.distance_value;
    if (body.distance_unit !== undefined) update.distance_unit = body.distance_unit;
    if (body.review_status !== undefined) update.review_status = body.review_status;

    const { error } = await supabaseAdmin.from("programme_cardio_draft_sessions").update(update).eq("id", sessionId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ id: sessionId });
  } catch (err) {
    console.error("update cardio draft session failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Update failed: ${detail}` }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  try {
    const { error } = await supabaseAdmin.from("programme_cardio_draft_sessions").delete().eq("id", sessionId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ id: sessionId });
  } catch (err) {
    console.error("delete cardio draft session failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Delete failed: ${detail}` }, { status: 500 });
  }
}
