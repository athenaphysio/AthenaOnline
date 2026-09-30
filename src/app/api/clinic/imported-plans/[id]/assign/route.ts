import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// The one point of no return for an imported plan -- nothing before this
// is client-visible. Assigning replaces whatever plan this client
// currently has (its own row moves to 'replaced', not deleted, so its
// history and logs stay intact) and makes this one 'assigned' instead.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: draft, error: draftError } = await supabaseAdmin
    .from("imported_plans")
    .select("id, patient_id, status")
    .eq("id", id)
    .maybeSingle<{ id: string; patient_id: string; status: string }>();
  if (draftError) return NextResponse.json({ error: draftError.message }, { status: 500 });
  if (!draft) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (draft.status !== "draft") {
    return NextResponse.json({ error: "This plan has already been assigned or replaced." }, { status: 400 });
  }

  const now = new Date().toISOString();

  const { error: supersedeError } = await supabaseAdmin
    .from("imported_plans")
    .update({ status: "replaced", replaced_at: now })
    .eq("patient_id", draft.patient_id)
    .eq("status", "assigned");
  if (supersedeError) return NextResponse.json({ error: supersedeError.message }, { status: 500 });

  const { error: assignError } = await supabaseAdmin
    .from("imported_plans")
    .update({ status: "assigned", assigned_at: now })
    .eq("id", id);
  if (assignError) return NextResponse.json({ error: assignError.message }, { status: 500 });

  return NextResponse.json({ ok: true, patient_id: draft.patient_id });
}
