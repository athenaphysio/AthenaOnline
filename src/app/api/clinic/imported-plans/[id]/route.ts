import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Cancel on the review screen -- only ever removes a still-unassigned
// draft, never a plan that's actually gone live or a superseded one kept
// for history.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: draft } = await supabaseAdmin
    .from("imported_plans")
    .select("id, status")
    .eq("id", id)
    .maybeSingle<{ id: string; status: string }>();
  if (!draft) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (draft.status !== "draft") {
    return NextResponse.json({ error: "Only an unassigned draft can be cancelled." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("imported_plans").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
