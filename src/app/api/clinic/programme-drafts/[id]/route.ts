import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// A programme saved in the builder but not yet sent. Nothing here is ever
// visible to the client; Send (POST /api/clinic/programmes) is still the
// only way a programme reaches them, and it clears this row when it does.

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    patient_id?: string;
    title?: string;
    state?: unknown;
    claude_draft_id?: string | null;
  };
  if (!body.patient_id || !body.state) {
    return NextResponse.json({ error: "Choose a client before saving." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("programme_drafts").upsert({
    id,
    patient_id: body.patient_id,
    title: body.title ?? "",
    state: body.state,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Built from a draft from Claude: the saved version now stands in for
  // it, so it leaves the "Drafts from Claude" list rather than showing twice.
  if (body.claude_draft_id) {
    await supabaseAdmin
      .from("imported_plans")
      .update({ status: "replaced", replaced_at: new Date().toISOString() })
      .eq("id", body.claude_draft_id)
      .eq("status", "draft");
  }

  return NextResponse.json({ ok: true });
}

// Delete an unwanted saved draft. Any session copies made while building
// it already carry a programme_id, so they stay out of the library.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await supabaseAdmin.from("programme_drafts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
