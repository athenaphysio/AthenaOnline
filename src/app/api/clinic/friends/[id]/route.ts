import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { name, job_title, bio_text, weblink, sort_order } = body as {
    name?: string;
    job_title?: string | null;
    bio_text?: string | null;
    weblink?: string | null;
    sort_order?: number;
  };

  if (name !== undefined && !name.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from("friends")
      .update({
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(job_title !== undefined ? { job_title: job_title?.trim() || null } : {}),
        ...(bio_text !== undefined ? { bio_text: bio_text?.trim() || null } : {}),
        ...(weblink !== undefined ? { weblink: weblink?.trim() || null } : {}),
        ...(sort_order !== undefined ? { sort_order } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ id });
  } catch (err) {
    console.error("update friend failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Update failed: ${detail}` }, { status: 500 });
  }
}

// No usage check before deleting -- unlike equipment, a friend isn't
// referenced from anywhere else in the schema, so a plain confirm on the
// client is the whole safety net (per the Phase 3 brief).
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { error } = await supabaseAdmin.from("friends").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ id });
  } catch (err) {
    console.error("delete friend failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Delete failed: ${detail}` }, { status: 500 });
  }
}
