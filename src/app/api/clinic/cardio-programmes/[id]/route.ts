import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Minimal by design: the only thing David can change here is review_status
// (see ReviewToggleButton.tsx) -- there's no authoring UI for this content,
// so no other fields are accepted.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as { review_status?: string };

  if (body.review_status !== "pending" && body.review_status !== "reviewed") {
    return NextResponse.json({ error: "review_status must be 'pending' or 'reviewed'." }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from("cardio_programmes")
      .update({ review_status: body.review_status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ id });
  } catch (err) {
    console.error("update cardio programme review status failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Update failed: ${detail}` }, { status: 500 });
  }
}
